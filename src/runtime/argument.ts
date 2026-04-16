import type { ArgumentNode, ValueNode } from '../lib/graphql'
import { Kind } from '../lib/graphql'
import { Variable } from './variable'

export type ArgumentMap = Record<string, unknown>

export function parseArguments(args: ArgumentMap): ArgumentNode[] {
  return Object.entries(args).map(([key, value]) => ({
    kind: Kind.ARGUMENT,
    name: { kind: Kind.NAME, value: key },
    value: parseValue(value),
  }))
}

export function parseValue(value: unknown): ValueNode {
  if (value instanceof Variable) {
    return {
      kind: Kind.VARIABLE,
      name: { kind: Kind.NAME, value: value.name },
    }
  }

  if (typeof value === 'function') {
    // EnumPackage: () => string
    return { kind: Kind.ENUM, value: value() }
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { kind: Kind.INT, value: String(value) }
      : { kind: Kind.FLOAT, value: String(value) }
  }

  if (typeof value === 'string') {
    return { kind: Kind.STRING, value, block: false }
  }

  if (typeof value === 'boolean') {
    return { kind: Kind.BOOLEAN, value }
  }

  if (value === null || value === undefined) {
    return { kind: Kind.NULL }
  }

  if (Array.isArray(value)) {
    return { kind: Kind.LIST, values: value.map(parseValue) }
  }

  if (typeof value === 'object') {
    return {
      kind: Kind.OBJECT,
      fields: Object.entries(value).map(([key, val]) => ({
        kind: Kind.OBJECT_FIELD,
        name: { kind: Kind.NAME, value: key },
        value: parseValue(val),
      })),
    }
  }

  throw new Error(`Cannot convert value to GraphQL: ${typeof value}`)
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('argument', () => {
    it('parseValue handles Variable', () => {
      const v = new Variable('id')
      const node = parseValue(v)
      expect(node.kind).toBe('Variable')
      expect((node as any).name.value).toBe('id')
    })

    it('parseValue handles enum (function)', () => {
      const enumVal = () => 'ANIME'
      const node = parseValue(enumVal)
      expect(node.kind).toBe('EnumValue')
      expect((node as any).value).toBe('ANIME')
    })

    it('parseValue handles integer', () => {
      const node = parseValue(42)
      expect(node.kind).toBe('IntValue')
    })

    it('parseValue handles float', () => {
      const node = parseValue(3.14)
      expect(node.kind).toBe('FloatValue')
    })

    it('parseValue handles string', () => {
      const node = parseValue('hello')
      expect(node.kind).toBe('StringValue')
    })

    it('parseValue handles boolean', () => {
      expect(parseValue(true).kind).toBe('BooleanValue')
      expect(parseValue(false).kind).toBe('BooleanValue')
    })

    it('parseValue handles null', () => {
      expect(parseValue(null).kind).toBe('NullValue')
      expect(parseValue(undefined).kind).toBe('NullValue')
    })

    it('parseValue throws for unsupported value types', () => {
      expect(() => parseValue(Symbol('x'))).toThrow('Cannot convert value to GraphQL: symbol')
    })

    it('parseValue handles array', () => {
      const node = parseValue([1, 2, 3])
      expect(node.kind).toBe('ListValue')
      expect((node as any).values).toHaveLength(3)
    })

    it('parseValue handles object', () => {
      const node = parseValue({ key: 'value' })
      expect(node.kind).toBe('ObjectValue')
      expect((node as any).fields).toHaveLength(1)
    })

    it('parseArguments builds ArgumentNode array', () => {
      const nodes = parseArguments({ name: 'world', count: 5 })
      expect(nodes).toHaveLength(2)
      expect(nodes[0].name.value).toBe('name')
      expect(nodes[1].name.value).toBe('count')
    })
  })
}
