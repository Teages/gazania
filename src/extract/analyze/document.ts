import type { DocumentNode, FragmentDefinitionNode, SelectionNode, SelectionSetNode } from '../../lib/graphql'
import type { DirectiveInput } from '../../runtime/directive'
import type { SelectionInput, SelectionObject } from '../../runtime/dollar'
import type { StaticBuilderChain, StaticDirectiveDef, StaticPartialDef, StaticPartialRef } from './types'
import { Kind, OperationTypeNode } from '../../lib/graphql'
import { createDocumentNodeContext } from '../../runtime/context'
import { parseDirectives } from '../../runtime/directive'
import { createEnumFunction } from '../../runtime/enum'
import { parseSelectionSet } from '../../runtime/selection'
import { parseVariableDefinitions } from '../../runtime/variable'
import { collectNestedPartialRefs, interpretSelectCallback } from './selection'
import { CircularPartialError } from './types'

/**
 * Wrap a SelectionInput so that any field callbacks carrying `_partialRefs`
 * inject Symbol-keyed `PartialResultValue` entries into their `_selection`.
 * This lets the runtime `parseSelectionSet` produce fragment spreads via its
 * existing `Object.getOwnPropertySymbols` path.
 */
export function wrapSelectionWithPartialRefs(
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

export function buildFragmentDef(
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

  seen.delete(partialDef.name)

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

export function collectAllFragmentDefs(
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

/**
 * Build a complete DocumentNode (operation or fragment) from a builder chain,
 * resolving partial refs into fragment spreads and pushing the corresponding
 * fragment definitions into the document.
 */
export function buildDocumentFromChain(
  chain: StaticBuilderChain,
  partialDefs: Map<string, StaticPartialDef>,
  literalScope?: Map<string, unknown>,
): DocumentNode {
  const { selection, partialRefs } = interpretSelectCallback(
    chain.selectCallback,
    chain.callbackParams.dollar,
    chain.callbackParams.vars,
    partialDefs,
    literalScope,
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

    const fragDefs = buildFragmentDef(partialDef, partialDefs, literalScope)
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

  return {
    kind: Kind.DOCUMENT,
    definitions: ctx.definitions.reverse(),
  } as DocumentNode
}
