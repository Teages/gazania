import type { Program } from 'estree'
import type { DocumentNode } from '../../lib/graphql'
import type { ParsedBlock as StaticParsedBlock } from '../files'
import type { ExtractManifest } from '../manifest'
import type { StaticBuilderChain, StaticPartialDef } from './types'
import { parseSync } from 'oxc-parser'
import { getFileImports, topologicalSort } from '../dependency-graph'
import { parseFile, staticOffsetToLine } from '../files'
import { addDocumentToManifest } from '../manifest'
import { createModuleResolver } from '../ts-program'
import { walkAST } from '../walk'
import { analyzeBuilderChain, isGazaniaSelectCall } from './chain'
import { collectExports, collectImports } from './imports'
import { buildDocumentFromChain } from './document'
import { collectPartialDefs, detectCircularPartialRefs, findUnresolvedSpreadRef } from './partial'
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
  crossFileBuilderNames: string[],
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

  // Accumulate builder names across blocks so later blocks see earlier aliases
  const accumulatedBuilderNames: string[] = []

  for (const block of blocks) {
    const contextMap: Record<string, unknown> = {}
    const { builderNames, namespace } = collectImports(block.ast, contextMap)

    // Merge cross-file builder names + names discovered in previous blocks
    builderNames.push(...crossFileBuilderNames, ...accumulatedBuilderNames)

    // Detect local builder aliases (e.g. const g = createGazania(...))
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
          && builderNames.includes(init.callee.name)
        ) {
          builderNames.push(decl.id.name)
          accumulatedBuilderNames.push(decl.id.name)
        }
      }
    })

    // Collect same-file partial defs
    const localPartials = collectPartialDefs(block.ast, builderNames, namespace)
    for (const [k, v] of localPartials) {
      mergedPartialDefs.set(k, v)
    }

    // Add cross-file partials
    for (const [k, v] of crossFilePartials) {
      mergedPartialDefs.set(k, v)
    }

    // Populate scopedDeps for local partials so they carry their home-file scope
    // when used cross-file. This lets buildFragmentDef resolve transitive deps.
    for (const [k, v] of localPartials) {
      if (!v.scopedDeps) {
        const deps = new Map(mergedPartialDefs)
        deps.delete(k)
        v.scopedDeps = deps
      }
    }

    // Collect exports
    const exports = collectExports(block.ast)
    for (const [k, v] of exports) {
      mergedExportMap.set(k, v)
    }

    // Detect builder exports for downstream files
    for (const [exportedName, localName] of exports) {
      if (builderNames.includes(localName)) {
        mergedBuilderExports.push(exportedName)
      }
    }

    // Walk AST for select calls → analyze chains → build documents
    const chains: StaticBuilderChain[] = []
    walkAST(block.ast, (node: any) => {
      if (!isGazaniaSelectCall(node, builderNames, namespace)) {
        return
      }
      const chain = analyzeBuilderChain(node, builderNames, namespace)
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
          skipped.push({
            file,
            line,
            reason: `Failed to statically analyze ${chain.type} "${chain.name}"`,
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

/** Full static extraction pipeline with same-file partial/section resolution. */
export function staticExtractWithPartials(
  code: string,
  filePath?: string,
): DocumentNode[] {
  const parseResult = parseSync(filePath ?? 'test.js', code)
  const ast = parseResult.program as unknown as Program
  const blocks: StaticParsedBlock[] = [{ code, ast, lineOffset: 0 }]

  const result = processFileStatic(blocks, filePath ?? 'test.js', new Map(), [])
  return result.documents
}

/**
 * Cross-file static extraction pipeline.
 *
 * Mirrors `extractWithCrossFileResolution()` from `src/extract/index.ts` but
 * replaces runtime VM evaluation with pure static AST analysis. Files are
 * parsed, sorted in dependency order, and processed in two passes to handle
 * circular imports.
 */
export async function staticExtractCrossFile(
  files: string[],
  options: { tsconfigPath: string, algorithm?: string },
): Promise<{
  manifest: ExtractManifest
  skipped: Array<{ file: string, line: number, reason: string }>
}> {
  const algorithm = options.algorithm ?? 'sha256'
  const resolver = await createModuleResolver(options.tsconfigPath)

  // Step 1: Parse all files
  const parsedFiles = new Map<string, StaticParsedBlock[]>()
  for (const file of files) {
    const blocks = await parseFile(file)
    if (blocks) {
      parsedFiles.set(file, blocks)
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

  for (const file of order) {
    const blocks = parsedFiles.get(file)
    if (!blocks) {
      continue
    }

    const imports = fileImportsMap.get(file) || []

    // Resolve cross-file bindings from already-processed files
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

    const result = processFileStatic(blocks, file, crossFilePartials, crossFileBuilderNames)

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

    const result = processFileStatic(blocks, file, crossFilePartials, crossFileBuilderNames)

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

  // After both passes, all scopedDeps are fully resolved.
  // Detect circular partial references across the full dependency graph.
  // Build a deduplicated map keyed by partial name, preferring the definition
  // from the file that owns the partial (where it was locally defined).
  const allPartialDefs = new Map<string, StaticPartialDef>()
  for (const bindings of fileBindings.values()) {
    for (const [k, v] of bindings.partialDefs) {
      // Prefer entries with scopedDeps set — they come from the file that
      // defines the partial (home file), not from a cross-file import.
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
