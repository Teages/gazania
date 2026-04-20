import type { IntrospectionQuery } from 'graphql'
import type { SchemaSource } from './schema'
import { extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildClientSchema, getIntrospectionQuery, GraphQLSchema, printSchema } from 'graphql'

export async function loadSchema(source: SchemaSource): Promise<string> {
  if (typeof source === 'function') {
    return await source()
  }

  if (typeof source === 'string') {
    return loadSchemaFromString(source)
  }

  if ('sdl' in source) {
    return source.sdl
  }

  if ('json' in source) {
    return loadSchemaFromJson(source.json)
  }

  // { url, headers?, method? }
  return loadSchemaFromUrl(source.url, source.headers, source.method)
}

async function loadSchemaFromString(value: string): Promise<string> {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return loadSchemaFromUrl(value)
  }

  const ext = extname(value).toLowerCase()

  if (ext === '.graphql' || ext === '.gql') {
    return loadSchemaFromSdlFile(value)
  }

  if (ext === '.json') {
    const { readFile } = await import('node:fs/promises')
    return loadSchemaFromJson(await readFile(value, 'utf-8'))
  }

  if (ext === '.ts' || ext === '.js') {
    return loadSchemaFromModule(value)
  }

  throw new Error(`Cannot determine schema type from path: ${value}`)
}

async function loadSchemaFromSdlFile(filePath: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  try {
    return await readFile(filePath, 'utf-8')
  }
  catch (cause) {
    throw new Error(`Failed to read SDL file: ${filePath}`, { cause })
  }
}

async function loadSchemaFromJson(raw: string): Promise<string> {
  try {
    return printSchema(buildClientSchema(JSON.parse(raw) as IntrospectionQuery))
  }
  catch (cause) {
    throw new Error('Failed to parse introspection JSON', { cause })
  }
}

async function loadSchemaFromModule(filePath: string): Promise<string> {
  const url = pathToFileURL(filePath).href
  const mod = await import(url)
  const schema = mod.schema ?? mod.default

  if (typeof schema === 'string') {
    return schema
  }

  if (schema instanceof GraphQLSchema) {
    return printSchema(schema)
  }

  throw new Error(
    `Schema not found in ${filePath}. Export a schema string or GraphQLSchema as "schema" or "default".`,
  )
}

async function loadSchemaFromUrl(
  url: string,
  headers?: Record<string, string>,
  method: 'GET' | 'POST' = 'POST',
): Promise<string> {
  const query = getIntrospectionQuery()

  let response: Response

  if (method === 'GET') {
    const u = new URL(url)
    u.searchParams.set('query', query)
    response = await fetch(u.href, { headers })
  }
  else {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ query }),
    })
  }

  if (!response.ok) {
    throw new Error(`Introspection request failed: ${response.status} ${response.statusText}`)
  }

  const { data } = await response.json() as { data: IntrospectionQuery }

  if (!data) {
    throw new Error('Introspection response missing "data" field')
  }

  return printSchema(buildClientSchema(data))
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
}
