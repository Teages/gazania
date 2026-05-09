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

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('partial-resolver: same-file partial/section resolution', async () => {
    const { parseSync } = await import('oxc-parser')
    const { collectImports } = await import('./imports')
    const { isGazaniaSelectCall, analyzeBuilderChain } = await import('./chain')
    const { walkAST } = await import('../walk')

    async function parseCode(code: string) {
      return parseSync('test.js', code).program as any
    }

    it('7. collectPartialDefs returns empty map when no partials', async () => {
      const ast = await parseCode(`
      import { gazania } from 'gazania'
      gazania.query('Simple').select($ => $.select(['id']))
    `)

      const contextMap: Record<string, unknown> = {}
      const { builderNames, namespace } = collectImports(ast, contextMap)
      const partialDefs = collectPartialDefs(ast, builderNames, namespace)

      expect(partialDefs.size).toBe(0)
    })

    it('8. collectPartialDefs finds partial and section', async () => {
      const ast = await parseCode(`
      import { gazania } from 'gazania'
      const p = gazania.partial('P').on('T').select($ => $.select(['a']))
      const s = gazania.section('S').on('U').select($ => $.select(['b']))
    `)

      const contextMap: Record<string, unknown> = {}
      const { builderNames, namespace } = collectImports(ast, contextMap)
      const partialDefs = collectPartialDefs(ast, builderNames, namespace)

      expect(partialDefs.size).toBe(2)
      expect(partialDefs.has('p')).toBe(true)
      expect(partialDefs.has('s')).toBe(true)
      expect(partialDefs.get('p')!.name).toBe('P')
      expect(partialDefs.get('p')!.typeName).toBe('T')
      expect(partialDefs.get('s')!.name).toBe('S')
      expect(partialDefs.get('s')!.typeName).toBe('U')
    })

    it('9. resolveSameFilePartials returns selection and fragmentDefs', async () => {
      const code = `
      import { gazania } from 'gazania'
      const uf = gazania.partial('UF').on('User').select($ => $.select(['id']))
      const q = gazania.query('Q').select($ => $.select([...uf(), 'name']))
    `
      const ast = await parseCode(code)
      const contextMap: Record<string, unknown> = {}
      const { builderNames, namespace } = collectImports(ast, contextMap)

      const partialDefs = collectPartialDefs(ast, builderNames, namespace)
      expect(partialDefs.size).toBe(1)

      const chains: any[] = []
      walkAST(ast, (node: any) => {
        if (!isGazaniaSelectCall(node, builderNames, namespace)) {
          return
        }
        const chain = analyzeBuilderChain(node, builderNames, namespace)
        if (chain) {
          chains.push(chain)
        }
      })

      const queryChain = chains.find(c => c.type === 'query')
      expect(queryChain).toBeDefined()

      const { selection, fragmentDefs } = resolveSameFilePartials(queryChain, partialDefs)

      expect(selection).toHaveLength(1)
      expect(selection).toContain('name')
      expect(fragmentDefs).toHaveLength(1)
      expect(fragmentDefs[0].name.value).toBe('UF')
      expect(fragmentDefs[0].typeCondition.name.value).toBe('User')
    })
  })
}
