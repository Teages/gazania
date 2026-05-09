import type { Program } from 'estree'
import type { DocumentNode } from '../../lib/graphql'
import type { ParsedBlock as StaticParsedBlock } from '../files'
import type { ExtractManifest } from '../manifest'
import type { StaticBuilderChain, StaticPartialDef } from './types'
import { parseSync } from 'oxc-parser'
import { getFileImports, topologicalSort } from '../dependency-graph'
import { parseFile, staticOffsetToLine } from '../files'
import { addDocumentToManifest } from '../manifest'
import { createModuleResolver, createTypeCheckerProgram } from '../ts-program'
import { walkAST } from '../walk'
import { analyzeBuilderChain, isGazaniaSelectCall } from './chain'
import { buildDocumentFromChain } from './document'
import { collectExports, collectImports } from './imports'
import { collectPartialDefs, detectCircularPartialRefs, findUnresolvedSpreadRef } from './partial'
import { collectBuilderNamesForFile } from './type-aware-ids'
import { CircularPartialError } from './types'

interface FileStaticBindings {
  partialDefs: Map<string, StaticPartialDef>
  exportMap: Map<string, string>
  builderExports: string[]
}

export function processFileStatic(
  blocks: StaticParsedBlock[],
  file: string,
  crossFilePartials: Map<string, StaticPartialDef>,
  builderNames: string[],
  namespace: string | undefined,
): {
  partialDefs: Map<string, StaticPartialDef>
  exportMap: Map<string, string>
  builderExports: string[]
  documents: DocumentNode[]
  skipped: Array<{ file: string, line: number, reason: string }>
} {
  const mergedPartialDefs = new Map<string, StaticPartialDef>()
  const mergedExportMap = new Map<string, string>()
  const mergedBuilderExports: string[] = []
  const documents: DocumentNode[] = []
  const skipped: Array<{ file: string, line: number, reason: string }> = []

  const accumulatedBuilderNames: string[] = []

  for (const block of blocks) {
    const blockBuilderNames = [...builderNames]

    blockBuilderNames.push(...accumulatedBuilderNames)

    walkAST(block.ast, (node: any) => {
      if (node.type !== 'VariableDeclaration') {
        return
      }
      for (const decl of node.declarations) {
        if (decl.id.type !== 'Identifier' || !decl.init) {
          continue
        }
        const init = decl.init
        if (
          init.type === 'CallExpression'
          && init.callee.type === 'Identifier'
          && blockBuilderNames.includes(init.callee.name)
        ) {
          blockBuilderNames.push(decl.id.name)
          accumulatedBuilderNames.push(decl.id.name)
        }
      }
    })

    const localPartials = collectPartialDefs(block.ast, blockBuilderNames, namespace)
    for (const [k, v] of localPartials) {
      mergedPartialDefs.set(k, v)
    }

    for (const [k, v] of crossFilePartials) {
      mergedPartialDefs.set(k, v)
    }

    for (const [k, v] of localPartials) {
      if (!v.scopedDeps) {
        const deps = new Map(mergedPartialDefs)
        deps.delete(k)
        v.scopedDeps = deps
      }
    }

    const exports = collectExports(block.ast)
    for (const [k, v] of exports) {
      mergedExportMap.set(k, v)
    }

    for (const [exportedName, localName] of exports) {
      if (blockBuilderNames.includes(localName)) {
        mergedBuilderExports.push(exportedName)
      }
    }

    const chains: StaticBuilderChain[] = []
    walkAST(block.ast, (node: any) => {
      if (!isGazaniaSelectCall(node, blockBuilderNames, namespace)) {
        return
      }
      const chain = analyzeBuilderChain(node, blockBuilderNames, namespace)
      if (chain) {
        chains.push(chain)
      }
    })

    const declaredNames = new Set<string>()
    walkAST(block.ast, (node: any) => {
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier') {
            declaredNames.add(decl.id.name)
          }
        }
      }
    })

    for (const chain of chains) {
      if (chain.type === 'partial' || chain.type === 'section') {
        continue
      }

      const unresolvedRef = findUnresolvedSpreadRef(chain.selectCallback, mergedPartialDefs, declaredNames)
      if (unresolvedRef) {
        skipped.push({
          file,
          line: staticOffsetToLine(block.code, chain.loc.start) + block.lineOffset,
          reason: unresolvedRef.reason,
        })
        continue
      }

      try {
        const doc = buildDocumentFromChain(chain, mergedPartialDefs)
        documents.push(doc)
      }
      catch (err) {
        const line = staticOffsetToLine(block.code, chain.loc.start) + block.lineOffset
        if (err instanceof CircularPartialError) {
          skipped.push({ file, line, reason: err.message })
        }
        else {
          const errMsg = err instanceof Error ? err.message : String(err)
          skipped.push({
            file,
            line,
            reason: `Failed to statically analyze ${chain.type} "${chain.name}": ${errMsg}`,
          })
        }
      }
    }
  }

  return {
    partialDefs: mergedPartialDefs,
    exportMap: mergedExportMap,
    builderExports: mergedBuilderExports,
    documents,
    skipped,
  }
}

export function staticExtractWithPartials(
  code: string,
  filePath?: string,
): DocumentNode[] {
  const parseResult = parseSync(filePath ?? 'test.js', code)
  const ast = parseResult.program as unknown as Program
  const blocks: StaticParsedBlock[] = [{ code, ast, lineOffset: 0 }]

  const { builderNames, namespace } = collectImports(ast, {})
  const result = processFileStatic(blocks, filePath ?? 'test.js', new Map(), builderNames, namespace)
  return result.documents
}

export async function staticExtractCrossFile(
  files: string[],
  options: { tsconfigPath: string, algorithm?: string },
): Promise<{
  manifest: ExtractManifest
  skipped: Array<{ file: string, line: number, reason: string }>
}> {
  const algorithm = options.algorithm ?? 'sha256'
  const resolver = await createModuleResolver(options.tsconfigPath)
  const { program, checker } = await createTypeCheckerProgram(options.tsconfigPath)
  const ts = await import('typescript').then(m => ('default' in m ? m.default : m) as typeof import('typescript'))

  // Step 1: Parse all files
  const parsedFiles = new Map<string, StaticParsedBlock[]>()
  for (const file of files) {
    const blocks = await parseFile(file)
    if (blocks) {
      parsedFiles.set(file, blocks)
    }
  }

  // Step 1b: Force-parse files the type checker knows have gazania builders
  // but were skipped by the string pre-filter (re-exported/aliased builders)
  for (const file of files) {
    if (parsedFiles.has(file)) {
      continue
    }
    const isSFC = file.endsWith('.vue') || file.endsWith('.svelte')
    if (isSFC) {
      continue
    }
    const tcResult = collectBuilderNamesForFile(ts, program, checker, file)
    if (tcResult.builderNames.length > 0 || tcResult.namespace !== undefined) {
      const blocks = await parseFile(file, { skipFilter: true })
      if (blocks) {
        parsedFiles.set(file, blocks)
      }
    }
  }

  const knownFiles = new Set(parsedFiles.keys())

  // Step 2: Build dependency graph from imports
  const deps = new Map<string, Set<string>>()
  const fileImportsMap = new Map<string, import('../dependency-graph').FileImport[]>()

  for (const [file, blocks] of parsedFiles) {
    const depSet = new Set<string>()
    const allImports: import('../dependency-graph').FileImport[] = []

    for (const block of blocks) {
      const imports = getFileImports(block.ast, file, resolver, knownFiles)
      allImports.push(...imports)
      for (const imp of imports) {
        depSet.add(imp.resolvedPath)
      }
    }

    deps.set(file, depSet)
    fileImportsMap.set(file, allImports)
  }

  // Step 3: Topological sort (dependencies first)
  const order = topologicalSort(deps, [...parsedFiles.keys()])

  // Step 4: First pass — process files in dependency order
  const manifest: ExtractManifest = { operations: {}, fragments: {} }

  const fileBindings = new Map<string, FileStaticBindings>()
  const fileSkipped = new Map<string, Array<{ file: string, line: number, reason: string }>>()
  const filesNeedingSecondPass = new Set<string>()

  function getBuilderInfoForFile(file: string, blocks: StaticParsedBlock[]): { builderNames: string[], namespace: string | undefined } {
    const isSFC = file.endsWith('.vue') || file.endsWith('.svelte')
    if (isSFC) {
      const mergedBuilderNames: string[] = []
      let namespace: string | undefined
      for (const block of blocks) {
        const { builderNames, namespace: ns } = collectImports(block.ast, {})
        mergedBuilderNames.push(...builderNames)
        if (ns) {
          namespace = ns
        }
      }
      return { builderNames: mergedBuilderNames, namespace }
    }
    const tcResult = collectBuilderNamesForFile(ts, program, checker, file)
    if (tcResult.builderNames.length > 0 || tcResult.namespace !== undefined) {
      return tcResult
    }
    const mergedBuilderNames: string[] = []
    let namespace: string | undefined
    for (const block of blocks) {
      const { builderNames, namespace: ns } = collectImports(block.ast, {})
      mergedBuilderNames.push(...builderNames)
      if (ns) {
        namespace = ns
      }
    }
    return { builderNames: mergedBuilderNames, namespace }
  }

  for (const file of order) {
    const blocks = parsedFiles.get(file)
    if (!blocks) {
      continue
    }

    const imports = fileImportsMap.get(file) || []

    const crossFilePartials = new Map<string, StaticPartialDef>()
    const crossFileBuilderNames: string[] = []
    let hadMissingImport = false

    for (const imp of imports) {
      const sourceBindings = fileBindings.get(imp.resolvedPath)
      if (!sourceBindings) {
        hadMissingImport = true
        continue
      }

      if (sourceBindings.builderExports.includes(imp.importedName)) {
        crossFileBuilderNames.push(imp.localName)
      }

      const localName = sourceBindings.exportMap.get(imp.importedName) || imp.importedName
      const partialDef = sourceBindings.partialDefs.get(localName)
      if (partialDef) {
        crossFilePartials.set(imp.localName, partialDef)
      }
    }

    if (hadMissingImport) {
      filesNeedingSecondPass.add(file)
    }

    const { builderNames, namespace } = getBuilderInfoForFile(file, blocks)
    const mergedBuilderNames = [...builderNames, ...crossFileBuilderNames]
    const result = processFileStatic(blocks, file, crossFilePartials, mergedBuilderNames, namespace)

    for (const doc of result.documents) {
      addDocumentToManifest(manifest, doc, algorithm)
    }

    fileSkipped.set(file, result.skipped)
    fileBindings.set(file, {
      partialDefs: result.partialDefs,
      exportMap: result.exportMap,
      builderExports: result.builderExports,
    })

    if (result.skipped.length > 0) {
      filesNeedingSecondPass.add(file)
    }
  }

  const secondPassOrder = order.filter(f => filesNeedingSecondPass.has(f))
  for (const file of secondPassOrder) {
    const blocks = parsedFiles.get(file)
    if (!blocks) {
      continue
    }

    const imports = fileImportsMap.get(file) || []

    const crossFilePartials = new Map<string, StaticPartialDef>()
    const crossFileBuilderNames: string[] = []

    for (const imp of imports) {
      const sourceBindings = fileBindings.get(imp.resolvedPath)
      if (!sourceBindings) {
        continue
      }

      if (sourceBindings.builderExports.includes(imp.importedName)) {
        crossFileBuilderNames.push(imp.localName)
      }

      const localName = sourceBindings.exportMap.get(imp.importedName) || imp.importedName
      const partialDef = sourceBindings.partialDefs.get(localName)
      if (partialDef) {
        crossFilePartials.set(imp.localName, partialDef)
      }
    }

    const { builderNames, namespace } = getBuilderInfoForFile(file, blocks)
    const mergedBuilderNames = [...builderNames, ...crossFileBuilderNames]
    const result = processFileStatic(blocks, file, crossFilePartials, mergedBuilderNames, namespace)

    for (const doc of result.documents) {
      addDocumentToManifest(manifest, doc, algorithm)
    }

    fileSkipped.set(file, result.skipped)
    fileBindings.set(file, {
      partialDefs: result.partialDefs,
      exportMap: result.exportMap,
      builderExports: result.builderExports,
    })
  }

  const allPartialDefs = new Map<string, StaticPartialDef>()
  for (const bindings of fileBindings.values()) {
    for (const [k, v] of bindings.partialDefs) {
      const existing = allPartialDefs.get(k)
      if (!existing || existing.scopedDeps === undefined) {
        allPartialDefs.set(k, v)
      }
    }
  }

  const cycles = detectCircularPartialRefs(allPartialDefs)
  if (cycles.size > 0) {
    const allSkipped = [...fileSkipped.values()].flat()
    for (const [cyclePath] of cycles) {
      allSkipped.push({
        file: '',
        line: 0,
        reason: `Circular fragment reference detected: ${cyclePath}. Fragment spreads must not form cycles (GraphQL spec 5.5.2.2).`,
      })
    }
    return { manifest, skipped: allSkipped }
  }

  const allSkipped = [...fileSkipped.values()].flat()
  return { manifest, skipped: allSkipped }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('partial-resolver: same-file partial/section resolution', async () => {
    const { print } = await import('graphql')

    it('1. single same-file partial', () => {
      const code = `
      import { gazania } from 'gazania'
      const userFields = gazania.partial('UserFields').on('User').select($ => $.select(['id', 'name']))
      gazania.query('GetUser').select($ => $.select([...userFields(), 'status']))
    `
      const docs = staticExtractWithPartials(code)
      expect(docs).toHaveLength(1)

      const output = print(docs[0])
      expect(output).toContain('...UserFields')
      expect(output).toContain('fragment UserFields on User')
      expect(output).toContain('id')
      expect(output).toContain('name')
      expect(output).toContain('status')
      expect(output).toContain('query GetUser')
    })

    it('2. single same-file section', () => {
      const code = `
      import { gazania } from 'gazania'
      const postSection = gazania.section('PostSection').on('Post').select($ => $.select(['title', 'body']))
      gazania.query('GetPosts').select($ => $.select([...postSection(), 'createdAt']))
    `
      const docs = staticExtractWithPartials(code)
      expect(docs).toHaveLength(1)

      const output = print(docs[0])
      expect(output).toContain('...PostSection')
      expect(output).toContain('fragment PostSection on Post')
      expect(output).toContain('title')
      expect(output).toContain('body')
      expect(output).toContain('createdAt')
      expect(output).toContain('query GetPosts')
    })

    it('3. multiple same-file partials', () => {
      const code = `
      import { gazania } from 'gazania'
      const userInfo = gazania.partial('UserInfo').on('User').select($ => $.select(['id', 'name']))
      const userAvatar = gazania.partial('UserAvatar').on('User').select($ => $.select(['avatarUrl']))
      gazania.query('GetUserProfile').select($ => $.select([...userInfo(), ...userAvatar()]))
    `
      const docs = staticExtractWithPartials(code)
      expect(docs).toHaveLength(1)

      const output = print(docs[0])
      expect(output).toContain('...UserInfo')
      expect(output).toContain('...UserAvatar')
      expect(output).toContain('fragment UserInfo on User')
      expect(output).toContain('fragment UserAvatar on User')
      expect(output).toContain('avatarUrl')
      expect(output).toContain('query GetUserProfile')
    })

    it('4. partial forward reference (declared AFTER query)', () => {
      const code = `
      import { gazania } from 'gazania'
      gazania.query('ForwardRef').select($ => $.select([...userFields(), 'active']))
      const userFields = gazania.partial('UserFields').on('User').select($ => $.select(['id', 'email']))
    `
      const docs = staticExtractWithPartials(code)
      expect(docs).toHaveLength(1)

      const output = print(docs[0])
      expect(output).toContain('...UserFields')
      expect(output).toContain('fragment UserFields on User')
      expect(output).toContain('id')
      expect(output).toContain('email')
      expect(output).toContain('active')
      expect(output).toContain('query ForwardRef')
    })

    it('5. partial with vars', () => {
      const code = `
      import { gazania } from 'gazania'
      const filteredItems = gazania.partial('FilteredItems').on('Item').vars({ limit: 'Int!' }).select(($, vars) => $.select(['name']))
      gazania.query('GetItems').select($ => $.select([...filteredItems()]))
    `
      const docs = staticExtractWithPartials(code)
      expect(docs).toHaveLength(1)

      const output = print(docs[0])
      expect(output).toContain('...FilteredItems')
      expect(output).toContain('fragment FilteredItems')
      expect(output).toContain('on Item')
      const doc = docs[0]
      const frag = doc.definitions.find((d: any) => d.kind === 'FragmentDefinition') as any
      expect(frag).toBeDefined()
      expect(frag.variableDefinitions).toHaveLength(1)
      expect(frag.variableDefinitions[0].variable.name.value).toBe('limit')
      expect(frag.variableDefinitions[0].type.type.name.value).toBe('Int')
    })

    it('6. partial with directives', () => {
      const code = `
      import { gazania } from 'gazania'
      const deprecatedFields = gazania.partial('DeprecatedFields').on('User').directives(() => [['@deprecated', { reason: 'use v2' }]]).select($ => $.select(['oldField']))
      gazania.query('Legacy').select($ => $.select([...deprecatedFields()]))
    `
      const docs = staticExtractWithPartials(code)
      expect(docs).toHaveLength(1)

      const output = print(docs[0])
      expect(output).toContain('...DeprecatedFields')
      expect(output).toContain('fragment DeprecatedFields on User')
      expect(output).toContain('@deprecated')
      expect(output).toContain('use v2')
    })

    it('10. partial-only selection (empty non-spread selection)', () => {
      const code = `
      import { gazania } from 'gazania'
      const allFields = gazania.partial('AllFields').on('Item').select($ => $.select(['id', 'label']))
      gazania.query('GetAll').select($ => $.select([...allFields()]))
    `
      const docs = staticExtractWithPartials(code)
      expect(docs).toHaveLength(1)

      const output = print(docs[0])
      expect(output).toContain('...AllFields')
      expect(output).toContain('fragment AllFields on Item')
      expect(output).toContain('id')
      expect(output).toContain('label')
      expect(output).toContain('query GetAll')
    })
  })
}
