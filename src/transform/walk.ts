import type { Node } from 'estree'

// Parsers like acorn add positional info not present in the estree spec
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
