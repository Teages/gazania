import { buildASTSchema, parse, printSchema } from 'graphql'

export const SCHEMA_HASH_ALGORITHM = 'SHA-256'

/**
 * Compute a canonical schema source hash from SDL.
 *
 * The SDL is parsed into a GraphQL schema and re-printed to normalize
 * whitespace, ordering, and formatting. This ensures the same logical
 * schema always produces the same hash regardless of input formatting.
 */
export async function computeSchemaSourceHash(sdl: string): Promise<string> {
  const canonical = printSchema(buildASTSchema(parse(sdl)))
  const data = new TextEncoder().encode(canonical)
  const buffer = await crypto.subtle.digest(SCHEMA_HASH_ALGORITHM, data)
  const bytes = new Uint8Array(buffer)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `sha256:${hex}`
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('computeSchemaSourceHash', async () => {
    const { buildSchema: _buildSchema, printSchema: _printSchema, parse: _parse } = await import('graphql')

    it('produces a sha256: prefixed hash', async () => {
      const sdl = `type Query { hello: String }`
      const hash = await computeSchemaSourceHash(sdl)
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/)
    })

    it('produces the same hash for equivalent SDL with different formatting', async () => {
      const sdl1 = `type Query { hello: String }`
      const sdl2 = `
        type Query {
          hello: String
        }
      `
      expect(await computeSchemaSourceHash(sdl1)).toBe(await computeSchemaSourceHash(sdl2))
    })

    it('produces different hashes for different schemas', async () => {
      const sdl1 = `type Query { hello: String }`
      const sdl2 = `type Query { world: String }`
      expect(await computeSchemaSourceHash(sdl1)).not.toBe(await computeSchemaSourceHash(sdl2))
    })
  })
}
