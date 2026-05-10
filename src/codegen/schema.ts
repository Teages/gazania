import type { GraphQLSchema } from 'graphql'

// ── Codegen input: three sources (no IO) ──────────────

/**
 * Schema source for `generate()`.
 *
 * - `string`: SDL text or introspection JSON (auto-detected by parseSchema)
 * - `GraphQLSchema`: already-parsed schema object
 */
export type SchemaSource = string | GraphQLSchema

// ── Config types: user-facing flexible input ──────────

export interface UrlSource {
  url: string
  headers?: Record<string, string>
  method?: 'GET' | 'POST'
}

export interface SdlSource {
  sdl: string
}

export interface JsonSource {
  json: string
}

export type GetterSource = () => string | Promise<string>

/**
 * User-configurable schema source (resolved by CLI loader).
 *
 * - `string`: URL (`http://`/`https://`) or local file path (`.graphql`, `.gql`, `.json`, `.ts`, `.js`)
 * - `{ url, headers?, method? }`: URL with custom fetch options
 * - `{ sdl }`: Inline SDL string
 * - `{ json }`: Inline introspection JSON string
 * - `() => string | Promise<string>`: Custom getter function returning SDL
 */
export type SchemaLoader = string | UrlSource | SdlSource | JsonSource | GetterSource

export interface GenerateOptions {
  scalars?: Record<string, string | { input: string, output: string }>
}

export interface Config {
  schema: SchemaLoader
  output: string
  scalars?: Record<string, string | { input: string, output: string }>
}

export type UserConfig = Config | Config[]

export function defineConfig(config: Config[]): Config[]
export function defineConfig(config: Config): Config
export function defineConfig(config: UserConfig): UserConfig {
  return config
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

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
}
