import type { DirectiveNode } from '../lib/graphql'
import type { ArgumentMap } from './argument'
import { Kind } from '../lib/graphql'
import { parseArguments } from './argument'

export type DirectiveInput = [
  def: `@${string}`,
  args: ArgumentMap,
]

export function parseDirectives(
  directives: DirectiveInput[] | undefined,
): readonly DirectiveNode[] {
  if (!directives || directives.length === 0) {
    return []
  }

  return directives.map(([def, args]) => ({
    kind: Kind.DIRECTIVE,
    name: {
      kind: Kind.NAME,
      value: def.slice(1), // remove leading '@'
    },
    arguments: parseArguments(args),
  }))
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('directive', () => {
    it('returns empty array for undefined', () => {
      expect(parseDirectives(undefined)).toEqual([])
    })

    it('returns empty array for empty array', () => {
      expect(parseDirectives([])).toEqual([])
    })

    it('parses a directive with args', () => {
      const nodes = parseDirectives([['@skip', { if: true }]])
      expect(nodes).toHaveLength(1)
      expect(nodes[0].name.value).toBe('skip')
      expect(nodes[0].arguments).toHaveLength(1)
    })

    it('parses multiple directives', () => {
      const nodes = parseDirectives([
        ['@skip', { if: true }],
        ['@include', { if: false }],
      ])
      expect(nodes).toHaveLength(2)
      expect(nodes[0].name.value).toBe('skip')
      expect(nodes[1].name.value).toBe('include')
    })
  })
}
