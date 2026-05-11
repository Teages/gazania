import type { Node, Program } from 'estree'
import { walkAST } from '../walk'

const GAZANIA_SPECIFIERS = new Set(['gazania'])

/**
 * Detect gazania imports in the AST and build a name map.
 * Pure AST walking — no VM, no runtime evaluation.
 *
 * Returns the names of imported identifiers that correspond to builder-producing
 * functions (e.g. `gazania`, `createGazania`), any namespace import name,
 * and whether any relevant gazania import was found.
 */
export function collectImports(
  ast: Program,
  contextMap: Record<string, unknown>,
): { builderNames: string[], namespace: string | undefined } {
  const builderNames: string[] = []
  let namespace: string | undefined

  walkAST(ast, (node: Node) => {
    if (node.type !== 'ImportDeclaration') {
      return
    }

    if (typeof node.source.value !== 'string' || !GAZANIA_SPECIFIERS.has(node.source.value)) {
      return
    }

    for (const spec of node.specifiers) {
      if (spec.type === 'ImportNamespaceSpecifier') {
        namespace = spec.local.name
        contextMap[spec.local.name] = true
      }
      else if (spec.type === 'ImportSpecifier') {
        const importedName = spec.imported.type === 'Identifier'
          ? spec.imported.name
          : String(spec.imported.value)
        contextMap[spec.local.name] = true
        if (importedName === 'createGazania' || importedName === 'gazania') {
          builderNames.push(spec.local.name)
        }
      }
      else if (spec.type === 'ImportDefaultSpecifier') {
        contextMap[spec.local.name] = true
      }
    }
  })

  return { builderNames, namespace }
}

/**
 * Collect exported names from the AST.
 * Maps exportedName → localVariableName for cross-file resolution.
 */
export function collectExports(ast: Program): Map<string, string> {
  const exports = new Map<string, string>()

  for (const node of ast.body) {
    if (node.type !== 'ExportNamedDeclaration') {
      continue
    }

    if (node.declaration?.type === 'VariableDeclaration') {
      for (const decl of node.declaration.declarations) {
        if (decl.id.type === 'Identifier') {
          exports.set(decl.id.name, decl.id.name)
        }
      }
    }
    else if (
      node.declaration?.type === 'FunctionDeclaration'
      && node.declaration.id
    ) {
      exports.set(node.declaration.id.name, node.declaration.id.name)
    }

    if (node.specifiers) {
      for (const spec of node.specifiers) {
        if (spec.type === 'ExportSpecifier') {
          const localName = spec.local.type === 'Identifier'
            ? spec.local.name
            : String(spec.local.value)
          const exportedName = spec.exported.type === 'Identifier'
            ? spec.exported.name
            : String(spec.exported.value)
          exports.set(exportedName, localName)
        }
      }
    }
  }

  return exports
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  async function parseCode(code: string) {
    const { parseSync } = await import('oxc-parser')
    return parseSync('test.js', code).program as any
  }

  describe('collectImports', () => {
    it('finds gazania import and populates builderNames', async () => {
      const ast = await parseCode(`import { gazania } from 'gazania'`)
      const contextMap: Record<string, unknown> = {}
      const result = collectImports(ast, contextMap)

      expect(result.builderNames).toEqual(['gazania'])
      expect(result.namespace).toBeUndefined()
      expect(contextMap.gazania).toBe(true)
    })

    it('finds createGazania import', async () => {
      const ast = await parseCode(`import { createGazania } from 'gazania'`)
      const contextMap: Record<string, unknown> = {}
      const result = collectImports(ast, contextMap)

      expect(result.builderNames).toEqual(['createGazania'])
    })

    it('handles namespace import', async () => {
      const ast = await parseCode(`import * as g from 'gazania'`)
      const contextMap: Record<string, unknown> = {}
      const result = collectImports(ast, contextMap)

      expect(result.builderNames).toEqual([])
      expect(result.namespace).toBe('g')
      expect(contextMap.g).toBe(true)
    })

    it('handles combined imports', async () => {
      const ast = await parseCode(`import { gazania, createGazania, something } from 'gazania'`)
      const contextMap: Record<string, unknown> = {}
      const result = collectImports(ast, contextMap)

      expect(result.builderNames).toContain('gazania')
      expect(result.builderNames).toContain('createGazania')
      expect(result.builderNames).toHaveLength(2)
    })

    it('returns empty for non-gazania imports', async () => {
      const ast = await parseCode(`import { something } from 'other'`)
      const contextMap: Record<string, unknown> = {}
      const result = collectImports(ast, contextMap)

      expect(result.builderNames).toEqual([])
      expect(result.namespace).toBeUndefined()
    })

    it('handles default import', async () => {
      const ast = await parseCode(`import gaz from 'gazania'`)
      const contextMap: Record<string, unknown> = {}
      const result = collectImports(ast, contextMap)

      expect(result.builderNames).toEqual([])
      expect(contextMap.gaz).toBe(true)
    })
  })

  describe('collectExports', () => {
    it('handles export const', async () => {
      const ast = await parseCode(`export const myQuery = 'hello'`)
      const exports = collectExports(ast)

      expect(exports.get('myQuery')).toBe('myQuery')
    })

    it('handles export function', async () => {
      const ast = await parseCode(`export function myFn() { return 1 }`)
      const exports = collectExports(ast)

      expect(exports.get('myFn')).toBe('myFn')
    })

    it('handles export { x as y }', async () => {
      const ast = await parseCode(`const _x = 1\nexport { _x as myExport }`)
      const exports = collectExports(ast)

      expect(exports.get('myExport')).toBe('_x')
    })

    it('handles multiple export specifiers', async () => {
      const ast = await parseCode(`const a = 1\nconst b = 2\nexport { a as x, b as y }`)
      const exports = collectExports(ast)

      expect(exports.get('x')).toBe('a')
      expect(exports.get('y')).toBe('b')
    })

    it('returns empty map for file with no exports', async () => {
      const ast = await parseCode(`const x = 1`)
      const exports = collectExports(ast)

      expect(exports.size).toBe(0)
    })

    it('handles export const with multiple declarations', async () => {
      const ast = await parseCode(`export const a = 1, b = 2`)
      const exports = collectExports(ast)

      expect(exports.get('a')).toBe('a')
      expect(exports.get('b')).toBe('b')
    })
  })
}
