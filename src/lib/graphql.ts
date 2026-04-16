import type { TypeNode, ValueNode } from 'graphql'

export type {
  ArgumentNode,
  DirectiveNode,
  DocumentNode,
  ExecutableDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionNode,
  SelectionSetNode,
  ValueNode,
  VariableDefinitionNode,
} from 'graphql'

export const Kind = {
  /** Name */
  NAME: 'Name',
  /** Document */
  DOCUMENT: 'Document',
  OPERATION_DEFINITION: 'OperationDefinition',
  VARIABLE_DEFINITION: 'VariableDefinition',
  SELECTION_SET: 'SelectionSet',
  FIELD: 'Field',
  ARGUMENT: 'Argument',
  /** Fragments */
  FRAGMENT_SPREAD: 'FragmentSpread',
  INLINE_FRAGMENT: 'InlineFragment',
  FRAGMENT_DEFINITION: 'FragmentDefinition',
  /** Values */
  VARIABLE: 'Variable',
  INT: 'IntValue',
  FLOAT: 'FloatValue',
  STRING: 'StringValue',
  BOOLEAN: 'BooleanValue',
  NULL: 'NullValue',
  ENUM: 'EnumValue',
  LIST: 'ListValue',
  OBJECT: 'ObjectValue',
  OBJECT_FIELD: 'ObjectField',
  /** Directives */
  DIRECTIVE: 'Directive',
  /** Types */
  NAMED_TYPE: 'NamedType',
  LIST_TYPE: 'ListType',
  NON_NULL_TYPE: 'NonNullType',
  /** Type System Definitions */
  SCHEMA_DEFINITION: 'SchemaDefinition',
  OPERATION_TYPE_DEFINITION: 'OperationTypeDefinition',
  /** Type Definitions */
  SCALAR_TYPE_DEFINITION: 'ScalarTypeDefinition',
  OBJECT_TYPE_DEFINITION: 'ObjectTypeDefinition',
  FIELD_DEFINITION: 'FieldDefinition',
  INPUT_VALUE_DEFINITION: 'InputValueDefinition',
  INTERFACE_TYPE_DEFINITION: 'InterfaceTypeDefinition',
  UNION_TYPE_DEFINITION: 'UnionTypeDefinition',
  ENUM_TYPE_DEFINITION: 'EnumTypeDefinition',
  ENUM_VALUE_DEFINITION: 'EnumValueDefinition',
  INPUT_OBJECT_TYPE_DEFINITION: 'InputObjectTypeDefinition',
  /** Directive Definitions */
  DIRECTIVE_DEFINITION: 'DirectiveDefinition',
  /** Type System Extensions */
  SCHEMA_EXTENSION: 'SchemaExtension',
  /** Type Extensions */
  SCALAR_TYPE_EXTENSION: 'ScalarTypeExtension',
  OBJECT_TYPE_EXTENSION: 'ObjectTypeExtension',
  INTERFACE_TYPE_EXTENSION: 'InterfaceTypeExtension',
  UNION_TYPE_EXTENSION: 'UnionTypeExtension',
  ENUM_TYPE_EXTENSION: 'EnumTypeExtension',
  INPUT_OBJECT_TYPE_EXTENSION: 'InputObjectTypeExtension',
  /** Schema Coordinates */
  TYPE_COORDINATE: 'TypeCoordinate',
  MEMBER_COORDINATE: 'MemberCoordinate',
  ARGUMENT_COORDINATE: 'ArgumentCoordinate',
  DIRECTIVE_COORDINATE: 'DirectiveCoordinate',
  DIRECTIVE_ARGUMENT_COORDINATE: 'DirectiveArgumentCoordinate',
} as typeof import('graphql').Kind

export const OperationTypeNode = {
  QUERY: 'query',
  MUTATION: 'mutation',
  SUBSCRIPTION: 'subscription',
} as typeof import('graphql').OperationTypeNode

export function parseType(input: string, _options?: unknown): TypeNode {
  const s = input.trim()
  if (s.endsWith('!')) {
    const inner = s.slice(0, -1).trim()
    if (inner.startsWith('[')) {
      return {
        kind: Kind.NON_NULL_TYPE,
        type: { kind: Kind.LIST_TYPE, type: parseType(inner.slice(1, -1)) },
      }
    }
    return {
      kind: Kind.NON_NULL_TYPE,
      type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: inner } },
    }
  }
  if (s.startsWith('[')) {
    return { kind: Kind.LIST_TYPE, type: parseType(s.slice(1, -1)) }
  }
  return { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: s } }
}

export function parseValue(input: string, _options?: unknown): ValueNode {
  const s = input.trim()

  if (s.startsWith('$')) {
    return { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: s.slice(1) } }
  }
  if (s === 'null') {
    return { kind: Kind.NULL }
  }
  if (s === 'true') {
    return { kind: Kind.BOOLEAN, value: true }
  }
  if (s === 'false') {
    return { kind: Kind.BOOLEAN, value: false }
  }

  if (s.startsWith('"""')) {
    return { kind: Kind.STRING, value: s.slice(3, -3), block: true }
  }
  if (s.startsWith('"')) {
    return { kind: Kind.STRING, value: _parseStringValue(s) }
  }

  if (s.startsWith('[')) {
    const inner = s.slice(1, -1).trim()
    const items = inner ? _splitValues(inner) : []
    return { kind: Kind.LIST, values: items.map(parseValue) }
  }

  if (s.startsWith('{')) {
    const inner = s.slice(1, -1).trim()
    const pairs = inner ? _splitValues(inner) : []
    return {
      kind: Kind.OBJECT,
      fields: pairs.map((pair) => {
        const colonIdx = pair.indexOf(':')
        const name = pair.slice(0, colonIdx).trim()
        const value = pair.slice(colonIdx + 1).trim()
        return {
          kind: Kind.OBJECT_FIELD,
          name: { kind: Kind.NAME, value: name },
          value: parseValue(value),
        }
      }),
    }
  }

  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(s)) {
    if (s.includes('.') || s.includes('e') || s.includes('E')) {
      return { kind: Kind.FLOAT, value: s }
    }
    return { kind: Kind.INT, value: s }
  }

  return { kind: Kind.ENUM, value: s }
}

function _parseStringValue(s: string, _options?: unknown): string {
  return s.slice(1, -1).replace(
    /\\(["\\/bfnrt]|u[0-9a-fA-F]{4})/g,
    (_, esc: string) => {
      if (esc[0] === 'u') {
        return String.fromCharCode(Number.parseInt(esc.slice(1), 16))
      }
      const escapes: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', 'b': '\b', 'f': '\f', 'n': '\n', 'r': '\r', 't': '\t' }
      return escapes[esc[0]]!
    },
  )
}

function _splitValues(s: string): string[] {
  const result: string[] = []
  let depth = 0
  let inStr = false
  let inBlock = false
  let start = 0

  for (let i = 0; i < s.length; i++) {
    if (inBlock) {
      if (s[i] === '"' && s[i + 1] === '"' && s[i + 2] === '"') {
        inBlock = inStr = false
        i += 2
      }
    }
    else if (inStr) {
      if (s[i] === '\\') {
        i++
      }
      else if (s[i] === '"') {
        inStr = false
      }
    }
    else {
      if (s[i] === '"') {
        if (s[i + 1] === '"' && s[i + 2] === '"') {
          inBlock = inStr = true
          i += 2
        }
        else {
          inStr = true
        }
      }
      else if (s[i] === '[' || s[i] === '{') {
        depth++
      }
      else if (s[i] === ']' || s[i] === '}') {
        depth--
      }
      else if (s[i] === ',' && depth === 0) {
        result.push(s.slice(start, i).trim())
        start = i + 1
      }
    }
  }

  const last = s.slice(start).trim()
  if (last) {
    result.push(last)
  }
  return result
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('parseType2', () => {
    describe('named types', () => {
      it('parses a simple named type', () => {
        expect(parseType('String')).toEqual({
          kind: 'NamedType',
          name: { kind: 'Name', value: 'String' },
        })
      })

      it('trims whitespace', () => {
        expect(parseType('  String  ')).toEqual({
          kind: 'NamedType',
          name: { kind: 'Name', value: 'String' },
        })
      })
    })

    describe('non-null types', () => {
      it('parses a non-null named type', () => {
        expect(parseType('String!')).toEqual({
          kind: 'NonNullType',
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        })
      })

      it('parses a non-null list type', () => {
        expect(parseType('[String]!')).toEqual({
          kind: 'NonNullType',
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        })
      })

      it('parses a non-null list of non-null items', () => {
        expect(parseType('[String!]!')).toEqual({
          kind: 'NonNullType',
          type: {
            kind: 'ListType',
            type: {
              kind: 'NonNullType',
              type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
            },
          },
        })
      })
    })

    describe('list types', () => {
      it('parses a list of a named type', () => {
        expect(parseType('[String]')).toEqual({
          kind: 'ListType',
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        })
      })

      it('parses a list of non-null items', () => {
        expect(parseType('[String!]')).toEqual({
          kind: 'ListType',
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        })
      })

      it('parses nested lists', () => {
        expect(parseType('[[Int]]')).toEqual({
          kind: 'ListType',
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        })
      })
    })
  })

  describe('parseValue2', () => {
    describe('variable', () => {
      it('parses a variable', () => {
        expect(parseValue('$name')).toEqual({
          kind: 'Variable',
          name: { kind: 'Name', value: 'name' },
        })
      })
    })

    describe('null', () => {
      it('parses null', () => {
        expect(parseValue('null')).toEqual({ kind: 'NullValue' })
      })
    })

    describe('boolean', () => {
      it('parses true', () => {
        expect(parseValue('true')).toEqual({ kind: 'BooleanValue', value: true })
      })

      it('parses false', () => {
        expect(parseValue('false')).toEqual({ kind: 'BooleanValue', value: false })
      })
    })

    describe('string', () => {
      it('parses a plain string', () => {
        expect(parseValue('"hello"')).toEqual({ kind: 'StringValue', value: 'hello' })
      })

      it('handles escape sequences', () => {
        expect(parseValue('"line1\\nline2"')).toEqual({ kind: 'StringValue', value: 'line1\nline2' })
        expect(parseValue('"tab\\there"')).toEqual({ kind: 'StringValue', value: 'tab\there' })
        expect(parseValue('"say \\"hi\\""')).toEqual({ kind: 'StringValue', value: 'say "hi"' })
      })

      it('handles unicode escape sequences', () => {
        expect(parseValue('"\\u0041"')).toEqual({ kind: 'StringValue', value: 'A' })
        expect(parseValue('"\\u4e2d\\u6587"')).toEqual({ kind: 'StringValue', value: '中文' })
      })

      it('parses a block string', () => {
        expect(parseValue('"""hello"""')).toEqual({ kind: 'StringValue', value: 'hello', block: true })
      })
    })

    describe('int', () => {
      it('parses a positive integer', () => {
        expect(parseValue('42')).toEqual({ kind: 'IntValue', value: '42' })
      })

      it('parses a negative integer', () => {
        expect(parseValue('-7')).toEqual({ kind: 'IntValue', value: '-7' })
      })

      it('parses zero', () => {
        expect(parseValue('0')).toEqual({ kind: 'IntValue', value: '0' })
      })
    })

    describe('float', () => {
      it('parses a float with decimal', () => {
        expect(parseValue('3.14')).toEqual({ kind: 'FloatValue', value: '3.14' })
      })

      it('parses a float with exponent', () => {
        expect(parseValue('1e5')).toEqual({ kind: 'FloatValue', value: '1e5' })
        expect(parseValue('2.5E-3')).toEqual({ kind: 'FloatValue', value: '2.5E-3' })
      })
    })

    describe('enum', () => {
      it('parses an enum value', () => {
        expect(parseValue('ACTIVE')).toEqual({ kind: 'EnumValue', value: 'ACTIVE' })
      })
    })

    describe('list', () => {
      it('parses an empty list', () => {
        expect(parseValue('[]')).toEqual({ kind: 'ListValue', values: [] })
      })

      it('parses a list containing a block string', () => {
        expect(parseValue('["""hello""", 1]')).toEqual({
          kind: 'ListValue',
          values: [
            { kind: 'StringValue', value: 'hello', block: true },
            { kind: 'IntValue', value: '1' },
          ],
        })
      })

      it('parses a list containing an empty string', () => {
        expect(parseValue('["", 1]')).toEqual({
          kind: 'ListValue',
          values: [
            { kind: 'StringValue', value: '' },
            { kind: 'IntValue', value: '1' },
          ],
        })
      })

      it('parses a list of ints', () => {
        expect(parseValue('[1, 2, 3]')).toEqual({
          kind: 'ListValue',
          values: [
            { kind: 'IntValue', value: '1' },
            { kind: 'IntValue', value: '2' },
            { kind: 'IntValue', value: '3' },
          ],
        })
      })

      it('parses a nested list', () => {
        expect(parseValue('[[1, 2], [3]]')).toEqual({
          kind: 'ListValue',
          values: [
            {
              kind: 'ListValue',
              values: [
                { kind: 'IntValue', value: '1' },
                { kind: 'IntValue', value: '2' },
              ],
            },
            {
              kind: 'ListValue',
              values: [{ kind: 'IntValue', value: '3' }],
            },
          ],
        })
      })
    })

    describe('object', () => {
      it('parses an empty object', () => {
        expect(parseValue('{}')).toEqual({ kind: 'ObjectValue', fields: [] })
      })

      it('parses an object with fields', () => {
        expect(parseValue('{name: "Alice", age: 30}')).toEqual({
          kind: 'ObjectValue',
          fields: [
            {
              kind: 'ObjectField',
              name: { kind: 'Name', value: 'name' },
              value: { kind: 'StringValue', value: 'Alice' },
            },
            {
              kind: 'ObjectField',
              name: { kind: 'Name', value: 'age' },
              value: { kind: 'IntValue', value: '30' },
            },
          ],
        })
      })

      it('parses a nested object', () => {
        expect(parseValue('{user: {id: 1}}')).toEqual({
          kind: 'ObjectValue',
          fields: [
            {
              kind: 'ObjectField',
              name: { kind: 'Name', value: 'user' },
              value: {
                kind: 'ObjectValue',
                fields: [
                  {
                    kind: 'ObjectField',
                    name: { kind: 'Name', value: 'id' },
                    value: { kind: 'IntValue', value: '1' },
                  },
                ],
              },
            },
          ],
        })
      })
    })
  })
}
