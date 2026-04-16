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
 * Schema source configuration.
 *
 * - `string`: URL (`http://`/`https://`) or local file path (`.graphql`, `.gql`, `.json`, `.ts`, `.js`)
 * - `{ url, headers?, method? }`: URL with custom fetch options
 * - `{ sdl }`: Inline SDL string
 * - `{ json }`: Inline introspection JSON string
 * - `() => string | Promise<string>`: Custom getter function returning SDL
 */
export type SchemaSource = string | UrlSource | SdlSource | JsonSource | GetterSource

export interface GenerateOptions {
  scalars?: Record<string, string | { input: string, output: string }>
}

export interface Config {
  schema: SchemaSource
  output: string
  scalars?: Record<string, string | { input: string, output: string }>
}

export type UserConfig = Config | Config[]

export function defineConfig(config: Config[]): Config[]
export function defineConfig(config: Config): Config
export function defineConfig(config: UserConfig): UserConfig {
  return config
}
