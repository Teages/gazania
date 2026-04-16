import { describe, expect, it } from 'vitest'
import { generate, loadSchema, parseSchema, printSchema } from '../src/codegen'
import { defineConfig } from '../src/codegen/schema'

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

describe('codegen', () => {
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
      expect(data.enumTypes.MediaType!.values).toEqual(['ANIME', 'MANGA'])
    })

    it('parses union types', () => {
      const data = parseSchema(SCHEMA_WITH_UNION)
      expect(data.unions).toHaveProperty('SearchResult')
      expect(data.unions.SearchResult!.types).toEqual(['Post', 'Video'])
    })

    it('parses input object types', () => {
      const data = parseSchema(SCHEMA_WITH_INPUT)
      expect(data.inputObjects).toHaveProperty('CreateUserInput')
      expect(data.inputObjects.CreateUserInput!.args).toHaveProperty('name')
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

  describe('printSchema', () => {
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

  describe('loadSchema', () => {
    it('loads SDL from string getter', async () => {
      const sdl = await loadSchema(() => SIMPLE_SDL)
      expect(sdl).toContain('type Query')
    })

    it('loads from inline SDL source', async () => {
      const sdl = await loadSchema({ sdl: SIMPLE_SDL })
      expect(sdl).toBe(SIMPLE_SDL)
    })

    it('throws for unknown string extension', async () => {
      await expect(loadSchema('schema.unknown')).rejects.toThrow()
    })
  })

  describe('generate', () => {
    it('generates TypeScript from getter', async () => {
      const code = await generate(() => SIMPLE_SDL)
      expect(code).toContain('export type Schema = DefineSchema<{')
      expect(code).toContain(`from 'gazania'`)
    })

    it('generates TypeScript from inline SDL', async () => {
      const code = await generate({ sdl: SCHEMA_WITH_ENUM })
      expect(code).toContain(`export type MediaType =`)
      expect(code).toContain(`export type Schema = DefineSchema<{`)
    })

    it('adds URL module augmentation', async () => {
      const url = 'https://api.example.com/graphql'
      const code = await generate({ sdl: SIMPLE_SDL }, { url })
      expect(code).toContain(`'${url}': Schema`)
    })
  })

  describe('defineConfig', () => {
    it('returns single config as-is', () => {
      const config = defineConfig({
        schema: 'https://api.example.com/graphql',
        output: './schema.d.ts',
        scalars: { DateTime: 'string' },
      })
      expect(config.schema).toBe('https://api.example.com/graphql')
      expect(config.output).toBe('./schema.d.ts')
    })

    it('returns config array as-is', () => {
      const configs = defineConfig([
        { schema: 'https://api.example.com/graphql', output: './schema-a.d.ts' },
        { schema: { sdl: 'type Query { noop: String }' }, output: './schema-b.d.ts' },
      ])
      expect(Array.isArray(configs)).toBe(true)
      expect(configs).toHaveLength(2)
      expect(configs[0]!.output).toBe('./schema-a.d.ts')
      expect(configs[1]!.output).toBe('./schema-b.d.ts')
    })
  })
})
