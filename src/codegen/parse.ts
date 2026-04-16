import type {
  DocumentNode,
  EnumTypeDefinitionNode,
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  NameNode,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  UnionTypeDefinitionNode,
} from 'graphql'
import type { GenerateOptions } from './schema'
import { Kind, parse, print } from 'graphql'

export interface ScalarTypeData {
  name: string
  input: string
  output: string
}

export interface EnumTypeData {
  name: string
  values: string[]
}

export interface FieldData {
  name: string
  res: string
  args: Record<string, string>
}

export interface InputObjectData {
  name: string
  args: Record<string, string>
}

export interface TypeObjectData {
  name: string
  fields: FieldData[]
  impl: string[]
}

export interface InterfaceObjectData extends TypeObjectData {}

export interface UnionData {
  name: string
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

  constructor(schema: DocumentNode, options?: GenerateOptions) {
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
    values: def.values?.map(v => parseName(v.name)) ?? [],
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
  return { name, input, output }
}

function parseInputObjectNode(def: InputObjectTypeDefinitionNode): InputObjectData {
  const name = parseName(def.name)
  const args: Record<string, string> = {}
  for (const field of def.fields ?? []) {
    args[parseName(field.name)] = print(field.type)
  }
  return { name, args }
}

function parseInterfaceNode(def: InterfaceTypeDefinitionNode): InterfaceObjectData {
  return {
    name: parseName(def.name),
    fields: def.fields?.map(parseFieldNode) ?? [],
    impl: def.interfaces?.map(i => parseName(i.name)) ?? [],
  }
}

function parseTypeObjectNode(def: ObjectTypeDefinitionNode): TypeObjectData {
  return {
    name: parseName(def.name),
    fields: def.fields?.map(parseFieldNode) ?? [],
    impl: def.interfaces?.map(i => parseName(i.name)) ?? [],
  }
}

function parseUnionNode(def: UnionTypeDefinitionNode): UnionData {
  return {
    name: parseName(def.name),
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
  }
}

function parseName(node: NameNode): string {
  return node.value
}

export function parseSchema(sdl: string, options?: GenerateOptions): SchemaData {
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
