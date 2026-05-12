import type { Program } from 'estree'
import type { TypeContext } from './chain'
import type { StaticPartialDef } from './types'
import { walkAST } from '../walk'
import { analyzeBuilderChain, isGazaniaSelectCall, resolvePartialFragmentName } from './chain'
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

      partialDefs.set(chain.name, {
        name: chain.name,
        typeName: chain.typeName!,
        variableDefs: chain.variableDefs,
        directives: chain.directives,
        selectCallback: chain.selectCallback,
        callbackParams: chain.callbackParams,
        nodeMap: typeCtx?.nodeMap,
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
  typeCtx?: TypeContext,
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

      let resolved = false
      if (typeCtx?.nodeMap) {
        const tsCallee = typeCtx.nodeMap.get(node.argument.callee)
        if (tsCallee) {
          const fragmentName = resolvePartialFragmentName(typeCtx.checker, tsCallee)
          if (fragmentName && knownPartials.has(fragmentName)) {
            resolved = true
          }
        }
      }

      if (!resolved) {
        const reason = declaredNames?.has(name)
          ? `${name} is not a partial or section (type check failed)`
          : `${name} is not defined or not imported`
        result = { name, reason, category: 'unresolved' }
      }
    }
  })
  return result
}

export function detectCircularPartialRefs(
  partialDefs: Map<string, StaticPartialDef>,
  checker?: import('typescript').TypeChecker,
): Map<string, string> {
  const cycles = new Map<string, string>()
  // Track canonical cycle signatures to deduplicate the same cycle found
  // from different starting points (e.g. "A → B → A" vs "B → A → B").
  const seenCycles = new Set<string>()

  for (const [_localName, def] of partialDefs) {
    const visited = new Set<string>()
    const path: string[] = []

    function visit(name: string, def: StaticPartialDef): void {
      if (visited.has(name)) {
        const cycleStart = path.indexOf(name)
        const cycleMembers = path.slice(cycleStart)
        // Canonical key: sorted names so A↔B and B↔A map to the same key
        const canonicalKey = [...cycleMembers].sort().join(',')
        if (!seenCycles.has(canonicalKey)) {
          seenCycles.add(canonicalKey)
          const cyclePath = [...cycleMembers, name].join(' → ')
          cycles.set(cyclePath, name)
        }
        return
      }
      visited.add(name)
      path.push(name)

      const typeCtx = (def.nodeMap && checker)
        ? { checker, nodeMap: def.nodeMap, builderNames: [], namespace: undefined }
        : undefined

      const result = interpretSelectCallback(
        def.selectCallback,
        def.callbackParams.dollar,
        def.callbackParams.vars,
        partialDefs,
        undefined,
        typeCtx,
      )

      for (const ref of result.partialRefs) {
        const refDef = partialDefs.get(ref.fragmentName)
        if (refDef) {
          visit(refDef.name, refDef)
        }
      }

      const nestedRefs = collectNestedPartialRefs(result.selection)
      for (const ref of nestedRefs) {
        const refDef = partialDefs.get(ref.fragmentName)
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
      expect(partialDefs.has('P')).toBe(true)
      expect(partialDefs.has('S')).toBe(true)
      expect(partialDefs.get('P')!.name).toBe('P')
      expect(partialDefs.get('P')!.typeName).toBe('T')
      expect(partialDefs.get('S')!.name).toBe('S')
      expect(partialDefs.get('S')!.typeName).toBe('U')
    })
  })
}
