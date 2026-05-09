import type { Program } from 'estree'
import type { DocumentNode, FragmentDefinitionNode, SelectionNode, SelectionSetNode } from '../../lib/graphql'
import type { DirectiveInput } from '../../runtime/directive'
import type { SelectionInput, SelectionObject } from '../../runtime/dollar'
import type { StaticBuilderChain, StaticDirectiveDef, StaticPartialDef, StaticPartialRef } from './types'
import { CircularPartialError } from './types'
import { createHash, getHashes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { print } from 'graphql'
import { parseSync } from 'oxc-parser'
import { transformSync } from 'oxc-transform'
import { Kind, OperationTypeNode } from '../../lib/graphql'
import { createDocumentNodeContext } from '../../runtime/context'
import { parseDirectives } from '../../runtime/directive'
import { createEnumFunction } from '../../runtime/enum'
import { parseSelectionSet } from '../../runtime/selection'
import { parseVariableDefinitions } from '../../runtime/variable'
import { getFileImports, topologicalSort } from '../dependency-graph'
import { getScriptBlocks } from '../preprocess'
import { createModuleResolver } from '../ts-program'
import { walkAST } from '../walk'
import { analyzeBuilderChain, collectExports, collectImports, isGazaniaSelectCall } from './chain'
import { collectNestedPartialRefs, interpretSelectCallback } from './selection'

/**
 * Wrap a SelectionInput so that any field callbacks carrying `_partialRefs`
 * inject Symbol-keyed `PartialResultValue` entries into their `_selection`.
 * This lets the runtime `parseSelectionSet` produce fragment spreads via its
 * existing `Object.getOwnPropertySymbols` path.
 */
function wrapSelectionWithPartialRefs(
  items: SelectionInput,
  partialDefs: Map<string, StaticPartialDef>,
): SelectionInput {
  return items.map((item) => {
    if (typeof item === 'string') {
      return item
    }
    const obj = item as SelectionObject
    const newObj: SelectionObject = {}
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'function') {
        newObj[key] = wrapFieldCallback(value as (dollar: any) => any, partialDefs)
      }
      else {
        ;(newObj as any)[key] = value
      }
    }
    return newObj
  })
}

function wrapFieldCallback(
  fn: (dollar: any) => any,
  partialDefs: Map<string, StaticPartialDef>,
): (dollar: any) => any {
  const refs: StaticPartialRef[] | undefined = (fn as any)._partialRefs

  const wrapped = (dollar: any): any => {
    const result = fn(dollar)

    if (result._selection && result._selection.length > 0) {
      result._selection = wrapSelectionWithPartialRefs(result._selection, partialDefs)
    }

    if (refs && refs.length > 0) {
      const partialEntries: any[] = []
      for (const ref of refs) {
        const partialDef = partialDefs.get(ref.localName)
        if (!partialDef) {
          continue
        }

        const fragDefs = buildFragmentDef(partialDef, partialDefs)
        if (fragDefs && fragDefs.length > 0) {
          const sym = Symbol('@gazania:PartialContent')
          partialEntries.push({
            [sym]: {
              _fragmentName: partialDef.name,
              _documentNode: { definitions: fragDefs },
            },
          })
        }
      }

      if (partialEntries.length > 0) {
        if (!result._selection || result._selection.length === 0) {
          result._selection = partialEntries
        }
        else {
          result._selection = [...result._selection, ...partialEntries]
        }
      }
    }

    return result
  }

  if (refs) {
    ;(wrapped as any)._partialRefs = refs
  }

  return wrapped
}

function interpretDirectiveCallback(def: StaticDirectiveDef): DirectiveInput[] {
  const { callback } = def
  const body = (callback as any).body
  if (!body) {
    return []
  }

  let returnExpr: any = body
  if (body.type === 'BlockStatement') {
    for (const stmt of body.body) {
      if (stmt.type === 'ReturnStatement' && stmt.argument) {
        returnExpr = stmt.argument
        break
      }
    }
    if (returnExpr === body) {
      return []
    }
  }

  if (returnExpr.type !== 'ArrayExpression') {
    return []
  }

  const results: DirectiveInput[] = []
  for (const el of returnExpr.elements ?? []) {
    if (!el || el.type !== 'ArrayExpression' || el.elements.length < 2) {
      continue
    }
    const nameNode = el.elements[0]
    const argsNode = el.elements[1]
    if (nameNode?.type === 'Literal' && typeof nameNode.value === 'string') {
      const directiveName = nameNode.value as `@${string}`
      const args: Record<string, unknown> = {}
      if (argsNode?.type === 'ObjectExpression') {
        for (const prop of argsNode.properties) {
          if (
            prop.type === 'Property'
            && prop.key.type === 'Identifier'
            && prop.value.type === 'Literal'
          ) {
            args[prop.key.name] = prop.value.value
          }
        }
      }
      results.push([directiveName, args])
    }
  }

  return results
}

function buildFragmentDef(
  partialDef: StaticPartialDef,
  partialDefs: Map<string, StaticPartialDef>,
  literalScope?: Map<string, unknown>,
  seen?: Set<string>,
): FragmentDefinitionNode[] | null {
  if (!seen) {
    seen = new Set()
  }
  if (seen.has(partialDef.name)) {
    const cyclePath = [...seen, partialDef.name].join(' → ')
    throw new CircularPartialError(partialDef.name, cyclePath)
  }
  seen.add(partialDef.name)

  // Merge home-file scope so the partial's callback can resolve its own deps
  // (e.g. transitive cross-file partials that the consumer file doesn't directly import)
  const effectiveDefs: Map<string, StaticPartialDef> = partialDef.scopedDeps
    ? new Map([...partialDef.scopedDeps, ...partialDefs])
    : partialDefs

  const partialResult = interpretSelectCallback(
    partialDef.selectCallback,
    partialDef.callbackParams.dollar,
    partialDef.callbackParams.vars,
    effectiveDefs,
    literalScope,
  )

  const enumFn = createEnumFunction()
  const fragCtx = createDocumentNodeContext()

  const fragDirectives: DirectiveInput[] = partialDef.directives?.length
    ? partialDef.directives.flatMap(interpretDirectiveCallback)
    : []

  // Wrap field callbacks so field-nested partial refs (e.g. ...postFields inside a
  // posts field callback) are resolved the same way as in top-level operation processing.
  const wrappedSelection = wrapSelectionWithPartialRefs(partialResult.selection, effectiveDefs)

  let fragSelectionSet: SelectionSetNode
  if (wrappedSelection.length > 0) {
    fragSelectionSet = parseSelectionSet(wrappedSelection, fragCtx, enumFn)
  }
  else {
    fragSelectionSet = { kind: Kind.SELECTION_SET, selections: [] }
  }

  for (const nestedRef of partialResult.partialRefs) {
    const nestedDef = effectiveDefs.get(nestedRef.localName)
    if (!nestedDef) {
      continue
    }

    const nestedFragDefs = buildFragmentDef(nestedDef, effectiveDefs, literalScope, seen)
    if (nestedFragDefs && nestedFragDefs.length > 0) {
      for (const d of nestedFragDefs) {
        fragCtx.pushDefinition(d)
      }
      ;(fragSelectionSet.selections as SelectionNode[]).push({
        kind: Kind.FRAGMENT_SPREAD,
        name: { kind: Kind.NAME, value: nestedDef.name },
      } as any)
    }
  }

  const fieldCallbackRefs = collectNestedPartialRefs(partialResult.selection)
  for (const nestedRef of fieldCallbackRefs) {
    const nestedDef = effectiveDefs.get(nestedRef.localName)
    if (!nestedDef) {
      continue
    }

    buildFragmentDef(nestedDef, effectiveDefs, literalScope, seen)
  }

  const mainFragDef: FragmentDefinitionNode = {
    kind: Kind.FRAGMENT_DEFINITION,
    name: { kind: Kind.NAME, value: partialDef.name },
    typeCondition: {
      kind: Kind.NAMED_TYPE,
      name: { kind: Kind.NAME, value: partialDef.typeName },
    },
    selectionSet: fragSelectionSet,
    variableDefinitions: partialDef.variableDefs
      ? parseVariableDefinitions(partialDef.variableDefs)
      : [],
    directives: parseDirectives(fragDirectives),
  } as FragmentDefinitionNode

  return [mainFragDef, ...(fragCtx.definitions as FragmentDefinitionNode[])]
}

function collectAllFragmentDefs(
  refs: StaticPartialRef[],
  partialDefs: Map<string, StaticPartialDef>,
  literalScope?: Map<string, unknown>,
): FragmentDefinitionNode[] {
  const fragmentDefs: FragmentDefinitionNode[] = []
  const seen = new Set<string>()

  function visit(refs: StaticPartialRef[]): void {
    for (const ref of refs) {
      const partialDef = partialDefs.get(ref.localName)
      if (!partialDef) {
        continue
      }

      const fragDefs = buildFragmentDef(partialDef, partialDefs, literalScope, seen)
      if (fragDefs) {
        fragmentDefs.push(...fragDefs)
      }

      const nestedResult = interpretSelectCallback(
        partialDef.selectCallback,
        partialDef.callbackParams.dollar,
        partialDef.callbackParams.vars,
        partialDefs,
        literalScope,
      )
      if (nestedResult.partialRefs.length > 0) {
        visit(nestedResult.partialRefs)
      }
    }
  }

  visit(refs)
  return fragmentDefs
}

/** Round 1: Collect all partial/section definitions from the AST. */
export function collectPartialDefs(
  ast: Program,
  builderNames: string[],
  namespace: string | undefined,
): Map<string, StaticPartialDef> {
  const partialDefs = new Map<string, StaticPartialDef>()

  walkAST(ast, (node: any) => {
    if (node.type !== 'VariableDeclaration') {
      return
    }

    for (const decl of node.declarations) {
      if (decl.id.type !== 'Identifier' || !decl.init) {
        continue
      }

      const init = decl.init
      if (init.type !== 'CallExpression') {
        continue
      }

      if (!isGazaniaSelectCall(init, builderNames, namespace)) {
        continue
      }

      const chain = analyzeBuilderChain(init, builderNames, namespace)
      if (!chain) {
        continue
      }
      if (chain.type !== 'partial' && chain.type !== 'section') {
        continue
      }

      partialDefs.set(decl.id.name, {
        name: chain.name,
        typeName: chain.typeName!,
        variableDefs: chain.variableDefs,
        directives: chain.directives,
        selectCallback: chain.selectCallback,
        callbackParams: chain.callbackParams,
      })
    }
  })

  return partialDefs
}

/** Resolve same-file partial references for a single builder chain. */
export function resolveSameFilePartials(
  chain: StaticBuilderChain,
  partialDefs: Map<string, StaticPartialDef>,
  literalScope?: Map<string, unknown>,
): { selection: SelectionInput, fragmentDefs: FragmentDefinitionNode[] } {
  const { selection, partialRefs } = interpretSelectCallback(
    chain.selectCallback,
    chain.callbackParams.dollar,
    chain.callbackParams.vars,
    partialDefs,
    literalScope,
  )

  const fragmentDefs = collectAllFragmentDefs(partialRefs, partialDefs, literalScope)

  return { selection, fragmentDefs }
}

/** Full static extraction pipeline with same-file partial/section resolution. */
export function staticExtractWithPartials(
  code: string,
  filePath?: string,
): DocumentNode[] {
  const ast = parseSync(filePath ?? 'test.js', code).program as any

  const contextMap: Record<string, unknown> = {}
  const { builderNames, namespace } = collectImports(ast, contextMap)

  walkAST(ast, (node: any) => {
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
      }
    }
  })

  const partialDefs = collectPartialDefs(ast, builderNames, namespace)

  const chains: StaticBuilderChain[] = []
  walkAST(ast, (node: any) => {
    if (!isGazaniaSelectCall(node, builderNames, namespace)) {
      return
    }
    const chain = analyzeBuilderChain(node, builderNames, namespace)
    if (chain) {
      chains.push(chain)
    }
  })

  const documents: DocumentNode[] = []

  for (const chain of chains) {
    if (chain.type === 'partial' || chain.type === 'section') {
      continue
    }

    const { selection, partialRefs } = interpretSelectCallback(
      chain.selectCallback,
      chain.callbackParams.dollar,
      chain.callbackParams.vars,
      partialDefs,
    )

    const wrappedSelection = wrapSelectionWithPartialRefs(selection, partialDefs)

    const ctx = createDocumentNodeContext()
    const enumFn = createEnumFunction()

    const opDirectives: DirectiveInput[] = chain.directives?.length
      ? chain.directives.flatMap(interpretDirectiveCallback)
      : []

    let selectionSet: SelectionSetNode
    if (wrappedSelection.length > 0) {
      selectionSet = parseSelectionSet(wrappedSelection, ctx, enumFn)
    }
    else {
      selectionSet = { kind: Kind.SELECTION_SET, selections: [] }
    }

    const seenFrags = new Set<string>()
    for (const ref of partialRefs) {
      const partialDef = partialDefs.get(ref.localName)
      if (!partialDef) {
        continue
      }
      if (seenFrags.has(partialDef.name)) {
        continue
      }
      seenFrags.add(partialDef.name)

      const fragDefs = buildFragmentDef(partialDef, partialDefs)
      if (fragDefs) {
        for (const fragDef of fragDefs) {
          ctx.pushDefinition(fragDef)
        }
      }

      ;(selectionSet.selections as SelectionNode[]).push({
        kind: Kind.FRAGMENT_SPREAD,
        name: { kind: Kind.NAME, value: partialDef.name },
      } as any)
    }

    if (chain.type === 'fragment') {
      ctx.pushDefinition({
        kind: Kind.FRAGMENT_DEFINITION,
        name: { kind: Kind.NAME, value: chain.name },
        typeCondition: {
          kind: Kind.NAMED_TYPE,
          name: { kind: Kind.NAME, value: chain.typeName! },
        },
        selectionSet,
        variableDefinitions: chain.variableDefs
          ? parseVariableDefinitions(chain.variableDefs)
          : [],
        directives: parseDirectives(opDirectives),
      })
    }
    else {
      const operationType = {
        query: OperationTypeNode.QUERY,
        mutation: OperationTypeNode.MUTATION,
        subscription: OperationTypeNode.SUBSCRIPTION,
      }[chain.type as 'query' | 'mutation' | 'subscription']

      ctx.pushDefinition({
        kind: Kind.OPERATION_DEFINITION,
        operation: operationType,
        name: chain.name
          ? { kind: Kind.NAME, value: chain.name }
          : undefined,
        variableDefinitions: chain.variableDefs
          ? parseVariableDefinitions(chain.variableDefs)
          : [],
        directives: parseDirectives(opDirectives),
        selectionSet,
      })
    }

    documents.push({
      kind: Kind.DOCUMENT,
      definitions: ctx.definitions.reverse(),
    })
  }

  return documents
}

interface FileStaticBindings {
  partialDefs: Map<string, StaticPartialDef>
  exportMap: Map<string, string>
  builderExports: string[]
}

interface StaticParsedBlock {
  code: string
  ast: Program
  lineOffset: number
}

function staticOffsetToLine(code: string, offset: number): number {
  return code.slice(0, offset).split('\n').length
}

/**
 * Walk a select callback AST and find the first SpreadElement whose callee
 * identifier is NOT in the knownPartials map. Returns the name and an
 * appropriate error reason distinguishing "not defined" from "not a function".
 */
function findUnresolvedSpreadRef(
  callbackNode: any,
  knownPartials: Map<string, StaticPartialDef>,
  declaredNames?: Set<string>,
): { name: string, reason: string } | null {
  let result: { name: string, reason: string } | null = null
  walkAST(callbackNode, (node: any) => {
    if (result) {
      return
    }
    if (
      node.type === 'SpreadElement'
      && node.argument?.type === 'CallExpression'
      && node.argument.callee?.type === 'Identifier'
    ) {
      const name = node.argument.callee.name
      if (!knownPartials.has(name)) {
        const reason = declaredNames?.has(name)
          ? `${name} is not a function`
          : `${name} is not defined`
        result = { name, reason }
      }
    }
  })
  return result
}

function staticComputeHash(body: string, algorithm: string): string {
  if (!getHashes().includes(algorithm)) {
    throw new Error(`Unsupported hash algorithm: "${algorithm}"`)
  }
  const hash = createHash(algorithm).update(body).digest('hex')
  return `${algorithm}:${hash}`
}

function staticGetOperationName(doc: DocumentNode): { name: string | undefined, type: 'operation' | 'fragment' } {
  if (doc.definitions.length === 0) {
    return { name: undefined, type: 'operation' }
  }
  const firstDef = doc.definitions[0]!
  if (firstDef.kind === 'FragmentDefinition') {
    return { name: (firstDef as any).name.value, type: 'fragment' }
  }
  if (firstDef.kind === 'OperationDefinition') {
    return { name: (firstDef as any).name?.value, type: 'operation' }
  }
  return { name: undefined, type: 'operation' }
}

function staticAddDocToManifest(
  manifest: { operations: Record<string, { body: string, hash: string }>, fragments: Record<string, { body: string, hash: string }> },
  doc: DocumentNode,
  algorithm: string,
): void {
  const body = print(doc)
  const hash = staticComputeHash(body, algorithm)
  const { name, type } = staticGetOperationName(doc)

  if (!name) {
    const HASH_PREFIX_LENGTH = 8
    const hashStart = hash.indexOf(':') + 1
    const anonKey = `Anonymous_${hash.slice(hashStart, hashStart + HASH_PREFIX_LENGTH)}`
    manifest.operations[anonKey] = { body, hash }
  }
  else if (type === 'fragment') {
    manifest.fragments[name] = { body, hash }
  }
  else {
    manifest.operations[name] = { body, hash }
  }
}

async function parseFileForStatic(filePath: string): Promise<StaticParsedBlock[] | null> {
  const rawCode = await readFile(filePath, 'utf-8')
  if (!rawCode.includes('gazania')) {
    return null
  }

  const scriptBlocks = getScriptBlocks(rawCode, filePath)
  const blocks: StaticParsedBlock[] = []

  for (const { code, lineOffset } of scriptBlocks) {
    if (!code.includes('gazania')) {
      continue
    }

    let evalCode = code
    const isSFC = filePath.endsWith('.vue') || filePath.endsWith('.svelte')

    try {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || isSFC) {
        const tsBasename = isSFC ? 'block.ts' : basename(filePath)
        const transformed = transformSync(tsBasename, code)
        if (transformed.errors.length > 0) {
          continue
        }
        evalCode = transformed.code
      }

      const parseFilename = filePath.endsWith('.jsx') ? 'eval.jsx' : 'eval.js'
      const parseResult = parseSync(parseFilename, evalCode)
      if (parseResult.errors.length > 0) {
        continue
      }

      blocks.push({ code: evalCode, ast: parseResult.program as unknown as Program, lineOffset })
    }
    catch {
      continue
    }
  }

  return blocks.length > 0 ? blocks : null
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
        const { selection, partialRefs } = interpretSelectCallback(
          chain.selectCallback,
          chain.callbackParams.dollar,
          chain.callbackParams.vars,
          mergedPartialDefs,
        )

        const wrappedSelection = wrapSelectionWithPartialRefs(selection, mergedPartialDefs)

        const ctx = createDocumentNodeContext()
        const enumFn = createEnumFunction()

        const opDirectives: DirectiveInput[] = chain.directives?.length
          ? chain.directives.flatMap(interpretDirectiveCallback)
          : []

        let selectionSet: SelectionSetNode
        if (wrappedSelection.length > 0) {
          selectionSet = parseSelectionSet(wrappedSelection, ctx, enumFn)
        }
        else {
          selectionSet = { kind: Kind.SELECTION_SET, selections: [] }
        }

        const seenFrags = new Set<string>()
        for (const ref of partialRefs) {
          const partialDef = mergedPartialDefs.get(ref.localName)
          if (!partialDef) {
            continue
          }
          if (seenFrags.has(partialDef.name)) {
            continue
          }
          seenFrags.add(partialDef.name)

          const fragDefs = buildFragmentDef(partialDef, mergedPartialDefs)
          if (fragDefs) {
            for (const fragDef of fragDefs) {
              ctx.pushDefinition(fragDef)
            }
          }

          ;(selectionSet.selections as SelectionNode[]).push({
            kind: Kind.FRAGMENT_SPREAD,
            name: { kind: Kind.NAME, value: partialDef.name },
          } as any)
        }

        if (chain.type === 'fragment') {
          ctx.pushDefinition({
            kind: Kind.FRAGMENT_DEFINITION,
            name: { kind: Kind.NAME, value: chain.name },
            typeCondition: {
              kind: Kind.NAMED_TYPE,
              name: { kind: Kind.NAME, value: chain.typeName! },
            },
            selectionSet,
            variableDefinitions: chain.variableDefs
              ? parseVariableDefinitions(chain.variableDefs)
              : [],
            directives: parseDirectives(opDirectives),
          })
        }
        else {
          const operationType = {
            query: OperationTypeNode.QUERY,
            mutation: OperationTypeNode.MUTATION,
            subscription: OperationTypeNode.SUBSCRIPTION,
          }[chain.type as 'query' | 'mutation' | 'subscription']

          ctx.pushDefinition({
            kind: Kind.OPERATION_DEFINITION,
            operation: operationType,
            name: chain.name
              ? { kind: Kind.NAME, value: chain.name }
              : undefined,
            variableDefinitions: chain.variableDefs
              ? parseVariableDefinitions(chain.variableDefs)
              : [],
            directives: parseDirectives(opDirectives),
            selectionSet,
          })
        }

        documents.push({
          kind: Kind.DOCUMENT,
          definitions: ctx.definitions.reverse(),
        })
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

function detectCircularPartialRefs(
  partialDefs: Map<string, StaticPartialDef>,
): Map<string, string> {
  const cycles = new Map<string, string>()

  for (const [localName, def] of partialDefs) {
    const visited = new Set<string>()
    const path: string[] = []

    function visit(name: string, def: StaticPartialDef): void {
      if (visited.has(name)) {
        const cycleStart = path.indexOf(name)
        const cyclePath = [...path.slice(cycleStart), name].join(' → ')
        cycles.set(cyclePath, name)
        return
      }
      visited.add(name)
      path.push(name)

      const result = interpretSelectCallback(
        def.selectCallback,
        def.callbackParams.dollar,
        def.callbackParams.vars,
        def.scopedDeps || partialDefs,
      )

      for (const ref of result.partialRefs) {
        const refDef = (def.scopedDeps || partialDefs).get(ref.localName)
        if (refDef) {
          visit(refDef.name, refDef)
        }
      }

      const nestedRefs = collectNestedPartialRefs(result.selection)
      for (const ref of nestedRefs) {
        const refDef = (def.scopedDeps || partialDefs).get(ref.localName)
        if (refDef) {
          visit(refDef.name, refDef)
        }
      }

      path.pop()
      visited.delete(name)
    }

    visit(def.name, def)
  }

  return cycles
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
  manifest: {
    operations: Record<string, { body: string, hash: string }>
    fragments: Record<string, { body: string, hash: string }>
  }
  skipped: Array<{ file: string, line: number, reason: string }>
}> {
  const algorithm = options.algorithm ?? 'sha256'
  const resolver = await createModuleResolver(options.tsconfigPath)

  // Step 1: Parse all files
  const parsedFiles = new Map<string, StaticParsedBlock[]>()
  for (const file of files) {
    const blocks = await parseFileForStatic(file)
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
  const manifest: {
    operations: Record<string, { body: string, hash: string }>
    fragments: Record<string, { body: string, hash: string }>
  } = { operations: {}, fragments: {} }

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
      staticAddDocToManifest(manifest, doc, algorithm)
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
      staticAddDocToManifest(manifest, doc, algorithm)
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
