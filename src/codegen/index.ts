import type { GenerateConfig } from './schema'
import { GraphQLSchema, printSchema as printGraphQLSchema } from 'graphql'
import { parseSchema } from './parse'
import { printSchema } from './print'

export { parseSchema } from './parse'
export { printSchema } from './print'
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
  const { buildSchema } = await import('graphql')

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

  describe('generate', () => {
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
  })
}
