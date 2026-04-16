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
