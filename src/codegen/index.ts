import type { GenerateConfig } from './schema'
import { GraphQLSchema, printSchema as printGraphQLSchema } from 'graphql'
import { parseSchema } from './parse'
import { printSchema } from './print'

export type { GenerateConfig } from './schema'

export function generate(config: GenerateConfig): string {
  const sdl = normalizeToSDL(config.source)
  const schemaData = parseSchema(sdl, config)
  return printSchema(schemaData, config)
}

function normalizeToSDL(source: string | GraphQLSchema): string {
  if (typeof source === 'string') {
    return source
  }
  if (source instanceof GraphQLSchema) {
    return printGraphQLSchema(source)
  }
  throw new Error('Invalid schema source: expected SDL string or GraphQLSchema')
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

  describe('generate', async () => {
    const { buildSchema } = await import('graphql')

    it('generates TypeScript from SDL string', () => {
      const code = generate({ source: SIMPLE_SDL })
      expect(code).toContain('export type Schema = DefineSchema<{')
      expect(code).toContain(`from 'gazania'`)
    })

    it('generates TypeScript from inline SDL', () => {
      const code = generate({ source: SCHEMA_WITH_ENUM })
      expect(code).toContain(`export type MediaType =`)
      expect(code).toContain(`export type Schema = DefineSchema<{`)
    })

    it('adds URL module augmentation', () => {
      const url = 'https://api.example.com/graphql'
      const code = generate({ source: SIMPLE_SDL, url })
      expect(code).toContain(`'${url}': Schema`)
    })

    it('generates TypeScript from a GraphQLSchema instance', () => {
      const schema = buildSchema(SIMPLE_SDL)
      const code = generate({ source: schema })
      expect(code).toContain('export type Schema = DefineSchema<{')
    })

    it('passes sourceHash through to output', () => {
      const code = generate({ source: SIMPLE_SDL, sourceHash: 'sha256:test' })
      expect(code).toContain(`, 'sha256:test'>`)
    })

    it('outputs JSDoc descriptions on object types and fields', () => {
      const sdl = `
        """The root query type"""
        type Query {
          """Say hello to the world"""
          hello: String
        }
      `
      const code = generate({ source: sdl })
      expect(code).toContain('/** The root query type */')
      expect(code).toContain('/** Say hello to the world */')
    })

    it('outputs @deprecated JSDoc for deprecated fields', () => {
      const sdl = `
        type Query {
          old: String @deprecated(reason: "Use new instead")
          new: String
        }
      `
      const code = generate({ source: sdl })
      expect(code).toContain('@deprecated Use new instead')
    })

    it('outputs @deprecated without reason', () => {
      const sdl = `
        type Query {
          old: String @deprecated
        }
      `
      const code = generate({ source: sdl })
      expect(code).toContain('/** @deprecated */')
    })

    it('outputs JSDoc on enum values', () => {
      const sdl = `
        enum Status {
          """Currently active"""
          ACTIVE
          INACTIVE @deprecated(reason: "Use ACTIVE only")
        }
        type Query { noop: String }
      `
      const code = generate({ source: sdl })
      expect(code).toContain('/** Currently active */')
      expect(code).toContain('@deprecated Use ACTIVE only')
    })
  })
}
