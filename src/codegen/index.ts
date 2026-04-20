import type { GenerateOptions, SchemaSource } from './schema'
import { loadSchema } from './loaders'
import { parseSchema } from './parse'
import { printSchema } from './print'

export { loadSchema } from './loaders'
export { parseSchema } from './parse'

export { printSchema } from './print'
export { defineConfig } from './schema'
export type { Config, GenerateOptions, GetterSource, JsonSource, SchemaSource, SdlSource, UrlSource, UserConfig } from './schema'

/**
 * Load a GraphQL schema and generate TypeScript type definitions.
 *
 * @param source - Schema source (URL, file path, SDL string, JSON string, or getter function)
 * @param options - Generation options (scalar mappings, etc.)
 * @returns TypeScript type definition string
 */
export async function generate(source: SchemaSource, options?: GenerateOptions & { url?: string }): Promise<string> {
  const sdl = await loadSchema(source)
  const schemaData = parseSchema(sdl, options)
  return printSchema(schemaData, options)
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
}
