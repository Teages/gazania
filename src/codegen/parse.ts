import type {
  ConstDirectiveNode,
  DocumentNode,
  EnumTypeDefinitionNode,
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  NameNode,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  StringValueNode,
  UnionTypeDefinitionNode,
} from 'graphql'
import type { GenerateConfig } from './schema'
import { Kind, parse, print } from 'graphql'

interface ScalarTypeData {
  name: string
  input: string
  output: string
  description?: string
}

interface EnumValueData {
  name: string
  description?: string
  deprecationReason?: string
}

interface EnumTypeData {
  name: string
  description?: string
  values: EnumValueData[]
}

interface FieldData {
  name: string
  res: string
  args: Record<string, string>
  description?: string
  deprecationReason?: string
}

interface InputFieldData {
  name: string
  type: string
  description?: string
  deprecationReason?: string
}

interface InputObjectData {
  name: string
  description?: string
  args: InputFieldData[]
}

interface TypeObjectData {
  name: string
  description?: string
  fields: FieldData[]
  impl: string[]
}

interface InterfaceObjectData extends TypeObjectData {}

interface UnionData {
  name: string
  description?: string
  types: string[]
}

const DEFAULT_SCALARS: Record<string, { input: string, output: string }> = {
  Int: { input: 'number', output: 'number' },
  Float: { input: 'number', output: 'number' },
  String: { input: 'string', output: 'string' },
  Boolean: { input: 'boolean', output: 'boolean' },
  ID: { input: 'string | number', output: 'string' },
}

export class SchemaData {
  scalarTypes: Record<string, ScalarTypeData> = {}
  enumTypes: Record<string, EnumTypeData> = {}
  inputObjects: Record<string, InputObjectData> = {}
  interfaceObjects: Record<string, InterfaceObjectData> = {}
  typeObjects: Record<string, TypeObjectData> = {}
  unions: Record<string, UnionData> = {}

  constructor(schema: DocumentNode, options?: Pick<GenerateConfig, 'scalars'>) {
    if (schema.kind !== Kind.DOCUMENT) {
      throw new Error('Invalid schema: expected DocumentNode')
    }

    for (const def of schema.definitions) {
      switch (def.kind) {
        case Kind.ENUM_TYPE_DEFINITION: {
          const node = parseEnumNode(def)
          if (this.enumTypes[node.name]) {
            throw new Error(`Duplicate enum type: ${node.name}`)
          }
          this.enumTypes[node.name] = node
          break
        }
        case Kind.SCALAR_TYPE_DEFINITION: {
          const node = parseScalarNode(def, options?.scalars)
          if (this.scalarTypes[node.name]) {
            throw new Error(`Duplicate scalar type: ${node.name}`)
          }
          this.scalarTypes[node.name] = node
          break
        }
        case Kind.INPUT_OBJECT_TYPE_DEFINITION: {
          const node = parseInputObjectNode(def)
          if (this.inputObjects[node.name]) {
            throw new Error(`Duplicate input object type: ${node.name}`)
          }
          this.inputObjects[node.name] = node
          break
        }
        case Kind.INTERFACE_TYPE_DEFINITION: {
          const node = parseInterfaceNode(def)
          if (this.interfaceObjects[node.name]) {
            throw new Error(`Duplicate interface type: ${node.name}`)
          }
          this.interfaceObjects[node.name] = node
          break
        }
        case Kind.OBJECT_TYPE_DEFINITION: {
          const node = parseTypeObjectNode(def)
          if (this.typeObjects[node.name]) {
            throw new Error(`Duplicate object type: ${node.name}`)
          }
          this.typeObjects[node.name] = node
          break
        }
        case Kind.UNION_TYPE_DEFINITION: {
          const node = parseUnionNode(def)
          if (this.unions[node.name]) {
            throw new Error(`Duplicate union type: ${node.name}`)
          }
          this.unions[node.name] = node
          break
        }
        default:
          break
      }
    }

    // Fill in default scalars if not already defined in the schema
    for (const [name, types] of Object.entries(DEFAULT_SCALARS)) {
      if (!this.scalarTypes[name]) {
        this.scalarTypes[name] = { name, ...types }
      }
    }
  }
}

function parseEnumNode(def: EnumTypeDefinitionNode): EnumTypeData {
  return {
    name: parseName(def.name),
    description: getDescription(def.description),
    values: def.values?.map(v => ({
      name: parseName(v.name),
      description: getDescription(v.description),
      deprecationReason: getDeprecationReason(v.directives),
    })) ?? [],
  }
}

function parseScalarNode(
  def: ScalarTypeDefinitionNode,
  scalars: Record<string, string | { input: string, output: string }> = {},
): ScalarTypeData {
  const name = parseName(def.name)
  const option = scalars[name] ?? 'unknown'
  const input = typeof option === 'string' ? option : option.input
  const output = typeof option === 'string' ? option : option.output
  return { name, input, output, description: getDescription(def.description) }
}

function parseInputObjectNode(def: InputObjectTypeDefinitionNode): InputObjectData {
  const name = parseName(def.name)
  const args: InputFieldData[] = []
  for (const field of def.fields ?? []) {
    args.push({
      name: parseName(field.name),
      type: print(field.type),
      description: getDescription(field.description),
      deprecationReason: getDeprecationReason(field.directives),
    })
  }
  return { name, description: getDescription(def.description), args }
}

function parseInterfaceNode(def: InterfaceTypeDefinitionNode): InterfaceObjectData {
  return {
    name: parseName(def.name),
    description: getDescription(def.description),
    fields: def.fields?.map(parseFieldNode) ?? [],
    impl: def.interfaces?.map(i => parseName(i.name)) ?? [],
  }
}

function parseTypeObjectNode(def: ObjectTypeDefinitionNode): TypeObjectData {
  return {
    name: parseName(def.name),
    description: getDescription(def.description),
    fields: def.fields?.map(parseFieldNode) ?? [],
    impl: def.interfaces?.map(i => parseName(i.name)) ?? [],
  }
}

function parseUnionNode(def: UnionTypeDefinitionNode): UnionData {
  return {
    name: parseName(def.name),
    description: getDescription(def.description),
    types: def.types?.map(t => parseName(t.name)) ?? [],
  }
}

function parseFieldNode(def: FieldDefinitionNode): FieldData {
  const args: Record<string, string> = {}
  for (const arg of def.arguments ?? []) {
    args[parseName(arg.name)] = print(arg.type)
  }
  return {
    name: parseName(def.name),
    res: print(def.type),
    args,
    description: getDescription(def.description),
    deprecationReason: getDeprecationReason(def.directives),
  }
}

function parseName(node: NameNode): string {
  return node.value
}

function getDescription(desc: StringValueNode | undefined): string | undefined {
  return desc?.value || undefined
}

function getDeprecationReason(directives: readonly ConstDirectiveNode[] | undefined): string | undefined {
  if (!directives) {
    return undefined
  }
  for (const dir of directives) {
    if (dir.name.value === 'deprecated') {
      if (dir.arguments) {
        for (const arg of dir.arguments) {
          if (arg.name.value === 'reason' && arg.value.kind === 'StringValue') {
            return arg.value.value || undefined
          }
        }
      }
      return ''
    }
  }
  return undefined
}

export function parseSchema(sdl: string, options?: Pick<GenerateConfig, 'scalars'>): SchemaData {
  let doc: DocumentNode | undefined

  try {
    doc = parse(sdl, { noLocation: true })
  }
  catch {
    try {
      doc = parse(print(JSON.parse(sdl)), { noLocation: true })
    }
    catch { /* ignore */ }
  }

  if (!doc) {
    throw new Error('Invalid schema: expected SDL string or introspection JSON')
  }

  return new SchemaData(doc, options)
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  const SIMPLE_SDL = `
  type Query {
    hello: String
    user(id: ID!): User
  }

  type User {
    id: ID!
    name: String!
    email: String
  }
`

  const SCHEMA_WITH_ENUM = `
  type Query {
    media(type: MediaType): Media
  }

  enum MediaType {
    ANIME
    MANGA
  }

  type Media {
    id: ID!
    title: String!
    type: MediaType!
  }
`

  const SCHEMA_WITH_UNION = `
  type Query {
    search: SearchResult
  }

  union SearchResult = Post | Video

  type Post {
    title: String!
  }

  type Video {
    duration: Int!
  }
`

  const SCHEMA_WITH_INPUT = `
  type Query {
    noop: String
  }

  type Mutation {
    createUser(input: CreateUserInput!): User
  }

  input CreateUserInput {
    name: String!
    email: String!
  }

  type User {
    id: ID!
    name: String!
  }
`

  const SCHEMA_WITH_INTERFACE = `
  type Query {
    node(id: ID!): Node
  }

  interface Node {
    id: ID!
  }

  type User implements Node {
    id: ID!
    name: String!
  }

  type Post implements Node {
    id: ID!
    title: String!
  }
`

  describe('parseSchema', () => {
    it('parses simple SDL', () => {
      const data = parseSchema(SIMPLE_SDL)
      expect(Object.keys(data.typeObjects)).toContain('Query')
      expect(Object.keys(data.typeObjects)).toContain('User')
    })

    it('includes default scalars', () => {
      const data = parseSchema(SIMPLE_SDL)
      expect(data.scalarTypes).toHaveProperty('String')
      expect(data.scalarTypes).toHaveProperty('ID')
      expect(data.scalarTypes).toHaveProperty('Int')
    })

    it('parses enum types', () => {
      const data = parseSchema(SCHEMA_WITH_ENUM)
      expect(data.enumTypes).toHaveProperty('MediaType')
      expect(data.enumTypes.MediaType!.values.map(v => v.name)).toEqual(['ANIME', 'MANGA'])
    })

    it('parses union types', () => {
      const data = parseSchema(SCHEMA_WITH_UNION)
      expect(data.unions).toHaveProperty('SearchResult')
      expect(data.unions.SearchResult!.types).toEqual(['Post', 'Video'])
    })

    it('parses input object types', () => {
      const data = parseSchema(SCHEMA_WITH_INPUT)
      expect(data.inputObjects).toHaveProperty('CreateUserInput')
      expect(data.inputObjects.CreateUserInput!.args.some(a => a.name === 'name')).toBe(true)
    })

    it('parses interface types', () => {
      const data = parseSchema(SCHEMA_WITH_INTERFACE)
      expect(data.interfaceObjects).toHaveProperty('Node')
    })

    it('respects custom scalar mappings', () => {
      const sdl = `scalar DateTime\ntype Query { now: DateTime }`
      const data = parseSchema(sdl, { scalars: { DateTime: 'string' } })
      expect(data.scalarTypes.DateTime!.input).toBe('string')
      expect(data.scalarTypes.DateTime!.output).toBe('string')
    })

    it('supports distinct input/output scalar types', () => {
      const sdl = `scalar Upload\ntype Query { file: Upload }`
      const data = parseSchema(sdl, {
        scalars: { Upload: { input: 'File', output: 'string' } },
      })
      expect(data.scalarTypes.Upload!.input).toBe('File')
      expect(data.scalarTypes.Upload!.output).toBe('string')
    })

    it('throws on invalid SDL', () => {
      expect(() => parseSchema('not valid graphql !!!')).toThrow()
    })
  })
}
