import type { VariableDefinitionNode } from '../lib/graphql'
import { Kind, parseType, parseValue } from '../lib/graphql'

export class Variable {
  readonly name: string
  constructor(name: string) {
    this.name = name
  }
}

export type VariableDefinitions = Record<string, string>

export function createVariableProxy(): Record<string, Variable> {
  return new Proxy(Object.create(null), {
    get: (_target, prop) => {
      if (typeof prop === 'string') {
        return new Variable(prop)
      }
    },
  })
}

export function parseVariableDefinitions(
  defs: VariableDefinitions,
): VariableDefinitionNode[] {
  return Object.entries(defs).map(([name, def]) => {
    const [type, defaultValue] = splitDefault(def)

    return {
      kind: Kind.VARIABLE_DEFINITION,
      variable: {
        kind: Kind.VARIABLE,
        name: { kind: Kind.NAME, value: name },
      },
      type: parseType(type, { noLocation: true }),
      defaultValue: defaultValue != null
        ? parseValue(defaultValue, { noLocation: true })
        : undefined,
    } as VariableDefinitionNode
  })
}

function splitDefault(def: string): [type: string, defaultValue: string | undefined] {
  const eqIndex = def.indexOf('=')
  if (eqIndex === -1) {
    return [def.trim(), undefined]
  }
  return [def.slice(0, eqIndex).trim(), def.slice(eqIndex + 1).trim()]
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('variable', () => {
    it('Variable stores name', () => {
      const v = new Variable('userId')
      expect(v.name).toBe('userId')
    })

    it('createVariableProxy returns Variable on any key', () => {
      const proxy = createVariableProxy()
      const v = proxy.id
      expect(v).toBeInstanceOf(Variable)
      expect(v.name).toBe('id')
    })

    it('createVariableProxy returns undefined for symbol keys', () => {
      const proxy = createVariableProxy()
      const symbolKey = Symbol('test')
      // @ts-expect-error expected to be undefined
      expect(proxy[symbolKey]).toBeUndefined()
    })

    it('parseVariableDefinitions handles required type', () => {
      const nodes = parseVariableDefinitions({ id: 'Int!' })
      expect(nodes).toHaveLength(1)
      expect(nodes[0].variable.name.value).toBe('id')
    })

    it('parseVariableDefinitions handles default value', () => {
      const nodes = parseVariableDefinitions({ id: 'Int = 42' })
      expect(nodes).toHaveLength(1)
      expect(nodes[0].defaultValue).toBeDefined()
    })

    it('parseVariableDefinitions handles string default with quotes', () => {
      const nodes = parseVariableDefinitions({ title: 'String = "hello"' })
      expect(nodes).toHaveLength(1)
      expect(nodes[0].defaultValue).toBeDefined()
    })

    it('parseVariableDefinitions handles list type', () => {
      const nodes = parseVariableDefinitions({ tags: '[String!]!' })
      expect(nodes).toHaveLength(1)
    })
  })
}
