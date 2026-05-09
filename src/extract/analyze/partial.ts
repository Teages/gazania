import type { Program } from 'estree'
import type { FragmentDefinitionNode } from '../../lib/graphql'
import type { SelectionInput } from '../../runtime/dollar'
import type { StaticBuilderChain, StaticPartialDef } from './types'
import { walkAST } from '../walk'
import { analyzeBuilderChain, isGazaniaSelectCall } from './chain'
import { collectAllFragmentDefs } from './document'
import { collectNestedPartialRefs, interpretSelectCallback } from './selection'

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

/**
 * Walk a select callback AST and find the first SpreadElement whose callee
 * identifier is NOT in the knownPartials map. Returns the name and an
 * appropriate error reason distinguishing "not defined" from "not a function".
 */
export function findUnresolvedSpreadRef(
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

export function detectCircularPartialRefs(
  partialDefs: Map<string, StaticPartialDef>,
): Map<string, string> {
  const cycles = new Map<string, string>()

  for (const [_localName, def] of partialDefs) {
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
