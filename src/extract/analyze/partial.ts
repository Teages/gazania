import type { Program } from 'estree'
import type { TypeContext } from './chain'
import type { StaticPartialDef } from './types'
import { walkAST } from '../walk'
import { analyzeBuilderChain, isGazaniaSelectCall } from './chain'
import { collectNestedPartialRefs, interpretSelectCallback } from './selection'

export function collectPartialDefs(
  ast: Program,
  builderNames: string[],
  namespace: string | undefined,
  typeCtx?: TypeContext,
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

      if (!isGazaniaSelectCall(init, builderNames, namespace, typeCtx)) {
        continue
      }

      const chain = analyzeBuilderChain(init, builderNames, namespace, typeCtx)
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

/**
 * Walk a select callback AST and find the first SpreadElement whose callee
 * identifier is NOT in the knownPartials map. Returns the name and an
 * appropriate error reason distinguishing "not defined" from "not a function".
 */
export function findUnresolvedSpreadRef(
  callbackNode: any,
  knownPartials: Map<string, StaticPartialDef>,
  declaredNames?: Set<string>,
): { name: string, reason: string, category: 'unresolved' } | null {
  let result: { name: string, reason: string, category: 'unresolved' } | null = null
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
        result = { name, reason, category: 'unresolved' }
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
    const { parse } = await import('@typescript-eslint/typescript-estree')
    const { collectImports } = await import('./imports')

    async function parseCode(code: string) {
      return parse(code, { range: true }) as any
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
  })
}
