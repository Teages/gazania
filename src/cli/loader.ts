import type { IntrospectionQuery } from 'graphql'
import type { SchemaLoader } from '../codegen/config'
import { extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildClientSchema, getIntrospectionQuery, GraphQLSchema, printSchema } from 'graphql'

export async function resolveSchema(source: SchemaLoader): Promise<string> {
  if (typeof source === 'function') {
    const result = await source()
    if (result instanceof GraphQLSchema) {
      return printSchema(result)
    }
    return result
  }
  if (typeof source === 'string') {
    return resolveString(source)
  }
  if ('url' in source) {
    return introspectFromUrl(source.url, source.headers, source.method)
  }
  if ('sdl' in source) {
    return source.sdl
  }
  if ('json' in source) {
    return jsonToSDL(source.json)
  }
  throw new Error('Invalid schema loader')
}

async function resolveString(value: string): Promise<string> {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return introspectFromUrl(value)
  }

  const ext = extname(value).toLowerCase()

  if (ext === '.graphql' || ext === '.gql') {
    return readFileSDL(value)
  }

  if (ext === '.json') {
    const { readFile } = await import('node:fs/promises')
    return jsonToSDL(await readFile(value, 'utf-8'))
  }

  if (ext === '.ts' || ext === '.js') {
    return loadFromModule(value)
  }

  if (ext || value.includes('/') || value.includes('\\')) {
    throw new Error(
      `Unknown schema source: ${value}\n`
      + 'If this is a file, use a supported extension: .graphql, .gql, .json, .ts, .js',
    )
  }

  // Bare SDL string
  return value
}

async function readFileSDL(filePath: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  try {
    return await readFile(filePath, 'utf-8')
  }
  catch (cause) {
    throw new Error(`Failed to read SDL file: ${filePath}`, { cause })
  }
}

function jsonToSDL(raw: string): string {
  try {
    return printSchema(buildClientSchema(JSON.parse(raw) as IntrospectionQuery))
  }
  catch (cause) {
    throw new Error('Failed to parse introspection JSON', { cause })
  }
}

async function loadFromModule(filePath: string): Promise<string> {
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

async function introspectFromUrl(
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
