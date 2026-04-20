import type { Node } from 'estree'

// oxc-parser adds positional info (start/end) directly on each node
export type NodeWithPosition = Node & { start: number, end: number }

/**
 * Walk an ESTree AST, calling `enter` for every node.
 */
export function walkAST(node: Node, enter: (node: Node) => void): void {
  enter(node)
  const record = node as unknown as Record<string, unknown>
  for (const key of Object.keys(record)) {
    const value = record[key]
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === 'string') {
            walkAST(child as Node, enter)
          }
        }
      }
      else if ('type' in value && typeof (value as Record<string, unknown>).type === 'string') {
        walkAST(value as Node, enter)
      }
    }
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  async function parseCode(code: string) {
    const { parseSync } = await import('oxc-parser')
    return parseSync('test.js', code).program as any
  }

  describe('walkAST', () => {
    it('visits all nodes in a simple AST', async () => {
      const ast = await parseCode(`const x = 1`)
      const types: string[] = []
      walkAST(ast, node => types.push(node.type))
      expect(types).toContain('Program')
      expect(types).toContain('VariableDeclaration')
      expect(types).toContain('Literal')
    })
  })
}
