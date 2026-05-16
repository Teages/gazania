import type { SchemaData } from './parse'
import type { GenerateConfig } from './schema'

export function printSchema(schemaData: SchemaData, options: Pick<GenerateConfig, 'scalars' | 'url'> = {}): string {
  const lines: string[] = []
  const push = (...strs: string[]) => lines.push(...strs)

  const helpers = new Set<string>()
  const nameMap = new Map<string, string>()

  // Build name map
  for (const name of Object.keys(schemaData.scalarTypes)) {
    nameMap.set(name, `Scalar_${name}`)
  }
  for (const name of Object.keys(schemaData.enumTypes)) {
    nameMap.set(name, `Enum_${name}`)
  }
  for (const name of Object.keys(schemaData.inputObjects)) {
    nameMap.set(name, `Input_${name}`)
  }
  for (const name of Object.keys(schemaData.typeObjects)) {
    nameMap.set(name, `Type_${name}`)
  }
  for (const name of Object.keys(schemaData.interfaceObjects)) {
    nameMap.set(name, `Interface_${name}`)
  }
  for (const name of Object.keys(schemaData.unions)) {
    nameMap.set(name, `Union_${name}`)
  }

  // Scalars
  for (const [name, { input, output }] of Object.entries(schemaData.scalarTypes)) {
    push(`type ${nameMap.get(name)} = ScalarType<'${name}', ${output}, ${input}>`)
  }
  if (Object.keys(schemaData.scalarTypes).length) {
    helpers.add('ScalarType')
    push('')
  }

  // Enums
  for (const [name, { values }] of Object.entries(schemaData.enumTypes)) {
    push(
      `export type ${name} =`,
      ...values.map(v => `  | '${v}'`),
      `type ${nameMap.get(name)} = EnumType<'${name}', ${name}>`,
      '',
    )
  }
  if (Object.keys(schemaData.enumTypes).length) {
    helpers.add('EnumType')
  }

  // Input objects
  for (const [name, { args }] of Object.entries(schemaData.inputObjects)) {
    push(
      `type ${nameMap.get(name)} = InputObjectType<'${name}', {`,
      ...Object.entries(args).map(
        ([key, val]) => `  ${key}: Input<${modifierToTypeStr(val, nameMap)}>`,
      ),
      `}>`,
      '',
    )
  }
  if (Object.keys(schemaData.inputObjects).length) {
    helpers.add('InputObjectType')
    helpers.add('Input')
  }

  // Object types
  for (const [name, { fields }] of Object.entries(schemaData.typeObjects)) {
    push(`type ${nameMap.get(name)} = ObjectType<'${name}', {`)
    for (const { name: fieldName, res, args } of fields) {
      if (Object.keys(args).length > 0) {
        push(
          `  ${fieldName}: Field<${modifierToTypeStr(res, nameMap)}, {`,
          ...Object.entries(args).map(
            ([key, val]) => `    ${key}: Input<${modifierToTypeStr(val, nameMap)}>`,
          ),
          `  }>`,
        )
        helpers.add('Input')
      }
      else {
        push(`  ${fieldName}: Field<${modifierToTypeStr(res, nameMap)}>`)
      }
      helpers.add('Field')
    }
    push(`}>`, '')
  }
  if (Object.keys(schemaData.typeObjects).length) {
    helpers.add('ObjectType')
  }

  // Interface types
  for (const [name, { fields }] of Object.entries(schemaData.interfaceObjects)) {
    // Collect all interface names (including transitive)
    const inheritedInterfaces = new Set<string>([name])
    const collectInherited = (ifaceName: string) => {
      for (const [n, { impl }] of Object.entries(schemaData.interfaceObjects)) {
        if (impl.includes(ifaceName) && !inheritedInterfaces.has(n)) {
          inheritedInterfaces.add(n)
          collectInherited(n)
        }
      }
    }
    collectInherited(name)

    // Collect implementing object types
    const entities = new Set<string>()
    for (const [typeName, { impl }] of Object.entries(schemaData.typeObjects)) {
      if (impl.some(i => inheritedInterfaces.has(i))) {
        entities.add(typeName)
      }
    }

    push(
      `type ${nameMap.get(name)} = InterfaceType<'${name}', {`,
      ...fields.map(({ name: fn, res }) => `  ${fn}: Field<${modifierToTypeStr(res, nameMap)}>`),
      `}, {`,
      ...Array.from(entities).map(k => `  ${k}: ${nameMap.get(k)}`),
      `}>`,
      '',
    )
  }
  if (Object.keys(schemaData.interfaceObjects).length) {
    helpers.add('InterfaceType')
    helpers.add('Field')
  }

  // Union types
  for (const [name, { types }] of Object.entries(schemaData.unions)) {
    // Collect all union member types (including transitive via nested unions)
    const inheritedUnions = new Set<string>([name])
    const collectUnions = (members: string[]) => {
      for (const member of members) {
        const child = schemaData.unions[member]
        if (child && !inheritedUnions.has(member)) {
          inheritedUnions.add(member)
          collectUnions(child.types)
        }
      }
    }
    collectUnions(types)

    const entities = new Set<string>()
    for (const uname of inheritedUnions) {
      for (const member of schemaData.unions[uname]!.types) {
        if (member in schemaData.typeObjects) {
          entities.add(member)
        }
      }
    }

    push(
      `type ${nameMap.get(name)} = UnionType<'${name}', {`,
      ...Array.from(entities).map(k => `  ${k}: ${nameMap.get(k)}`),
      `}>`,
      '',
    )
  }
  if (Object.keys(schemaData.unions).length) {
    helpers.add('UnionType')
  }

  // Schema declaration
  push(
    `export type Schema = DefineSchema<{`,
    ...Array.from(nameMap.entries()).map(([n, tn]) => `  ${n}: ${tn}`),
    `}>`,
    '',
  )
  helpers.add('DefineSchema')

  // Module augmentation for URL sources
  if (options.url) {
    push(
      `declare module 'gazania' {`,
      `  interface Schemas {`,
      `    '${options.url}': Schema`,
      `  }`,
      `}`,
      '',
    )
  }

  // Prepend imports
  lines.unshift(
    `/* eslint-disable */`,
    `import type { ${[...helpers].sort().join(', ')} } from 'gazania'`,
    '',
  )

  return lines.join('\n')
}

/**
 * Convert a GraphQL modifier string to a TypeScript type string using the name map.
 * e.g. '[User!]!' → 'Type_User[]'
 *      '[User]!'  → '(Type_User | null)[]'
 *      'User'     → 'Type_User | null'
 *      'String!'  → 'Scalar_String'
 */
function modifierToTypeStr(modifier: string, nameMap: Map<string, string>): string {
  return _modifierToTypeHelper(modifier, false, nameMap)
}

function _modifierToTypeHelper(modifier: string, nonNull: boolean, nameMap: Map<string, string>): string {
  if (modifier.endsWith('!')) {
    return _modifierToTypeHelper(modifier.slice(0, -1), true, nameMap)
  }
  if (modifier.startsWith('[') && modifier.endsWith(']')) {
    const inner = _modifierToTypeHelper(modifier.slice(1, -1), false, nameMap)
    const elementType = inner.includes(' | ') ? `(${inner})` : inner
    return nonNull ? `${elementType}[]` : `${elementType}[] | null`
  }
  // Base type
  const tsName = nameMap.get(modifier) ?? modifier
  return nonNull ? tsName : `${tsName} | null`
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

  describe('printSchema', async () => {
    const { parseSchema } = await import('./parse')

    it('generates DefineSchema export', () => {
      const data = parseSchema(SIMPLE_SDL)
      const code = printSchema(data)
      expect(code).toContain('export type Schema = DefineSchema<{')
    })

    it('generates enum union types', () => {
      const data = parseSchema(SCHEMA_WITH_ENUM)
      const code = printSchema(data)
      expect(code).toContain(`export type MediaType =`)
      expect(code).toContain(`| 'ANIME'`)
      expect(code).toContain(`| 'MANGA'`)
    })

    it('imports from gazania', () => {
      const data = parseSchema(SIMPLE_SDL)
      const code = printSchema(data)
      expect(code).toContain(`from 'gazania'`)
    })

    it('adds module augmentation for URL source', () => {
      const data = parseSchema(SIMPLE_SDL)
      const url = 'https://api.example.com/graphql'
      const code = printSchema(data, { url })
      expect(code).toContain(`declare module 'gazania'`)
      expect(code).toContain(`'${url}': Schema`)
    })

    it('does not add module augmentation without URL', () => {
      const data = parseSchema(SIMPLE_SDL)
      const code = printSchema(data)
      expect(code).not.toContain(`declare module 'gazania'`)
    })
  })
}
