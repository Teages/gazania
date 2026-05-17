import type { GraphQLSchema } from 'graphql'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd as getCwd } from 'node:process'
import { pathToFileURL } from 'node:url'

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

export type GetterSource = () => string | GraphQLSchema | Promise<string | GraphQLSchema>

export type SchemaLoader = string | UrlSource | SdlSource | JsonSource | GetterSource

export interface SchemaConfig {
  schema: SchemaLoader
  output: string
  scalars?: Record<string, string | { input: string, output: string }>
}

export interface ExtractConfig {
  /** Directory to scan for source files. Default: `'src'` */
  dir?: string
  /** Output manifest file path. Default: `null` (stdout). Use `'-'` for explicit stdout. */
  output?: string | null
  /** File glob pattern to include. Default: `'**\/*.{ts,tsx,js,jsx,vue,svelte}'` */
  include?: string
  /** Hash algorithm for operation identifiers. Default: `'sha256'` */
  algorithm?: string
  /** Path to tsconfig.json. Default: `'tsconfig.json'` (relative to config file) */
  tsconfig?: string
  /** Treat validation warnings (deprecated fields) as errors. Default: `false` */
  strict?: boolean
  /** Suppress manifest output. Default: `false` */
  noEmit?: boolean
  /** Categories of extraction errors to ignore. */
  ignoreCategories?: import('../extract/manifest').SkippedExtractionCategory[]
}

export interface Config {
  schemas: SchemaConfig[]
  extract?: ExtractConfig
}

export type UserConfig = Config | Config[]

export function defineConfig(config: Config[]): Config[]
export function defineConfig(config: Config): Config
export function defineConfig(config: UserConfig): UserConfig {
  return config
}

const CONFIG_CANDIDATES = ['gazania.config.ts', 'gazania.config.js']

function isValidConfigEntry(value: unknown): value is Config {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('schemas' in value) || !Array.isArray((value as Config).schemas) || (value as Config).schemas.length === 0) {
    return false
  }
  return (value as Config).schemas.every(
    s => typeof s === 'object' && s !== null
      && 'schema' in s && s.schema != null
      && 'output' in s && typeof s.output === 'string' && s.output.trim() !== '',
  )
}

/**
 * Load gazania config using native import().
 *
 * TypeScript config files require Node.js 22.6+ with native TS support.
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Loaded configs (normalized to array) or undefined if no config file found
 */
export async function loadConfig(cwd: string = getCwd()): Promise<Config[] | undefined> {
  for (const candidate of CONFIG_CANDIDATES) {
    const filePath = resolve(cwd, candidate)
    if (!existsSync(filePath)) {
      continue
    }

    const url = pathToFileURL(filePath).href
    let mod: { default?: unknown }

    try {
      mod = await import(url)
    }
    catch (cause) {
      const isTsFile = filePath.endsWith('.ts')
      if (isTsFile && cause instanceof Error && cause.message.includes('Unknown file extension')) {
        throw new Error(
          `Failed to load TypeScript config "${filePath}".\n`
          + `Native TypeScript support requires Node.js 22.6+ (use --experimental-strip-types on Node 22.6-23.5, or Node 23.6+ for stable support).\n`
          + `Alternatively, rename your config to "gazania.config.js".`,
          { cause },
        )
      }
      throw new Error(`Failed to load config from "${filePath}"`, { cause })
    }

    if (!mod.default || typeof mod.default !== 'object') {
      throw new Error(
        `Config file "${filePath}" must export a default config object or array. Use defineConfig() from 'gazania/config'.`,
      )
    }

    if (Array.isArray(mod.default)) {
      if (mod.default.length === 0 || !mod.default.every(isValidConfigEntry)) {
        throw new Error(
          `Config file "${filePath}" exports an invalid config array. Each entry must have a "schemas" field with at least one schema entry containing "schema" and "output".`,
        )
      }
      return mod.default as Config[]
    }

    if (!isValidConfigEntry(mod.default)) {
      throw new Error(
        `Config file "${filePath}" must have a "schemas" field with at least one schema entry. Use defineConfig() from 'gazania/config'.`,
      )
    }

    return [mod.default as Config]
  }

  return undefined
}

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach, afterEach } = import.meta.vitest
  const { mkdir, rm, writeFile } = await import('node:fs/promises')
  const { randomUUID } = await import('node:crypto')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')

  const SIMPLE_SDL = `type Query { hello: String }`

  describe('defineConfig', () => {
    it('returns single config as-is', () => {
      const config = defineConfig({
        schemas: [{ schema: 'https://api.example.com/graphql', output: './schema.d.ts', scalars: { DateTime: 'string' } }],
      })
      expect(config.schemas).toHaveLength(1)
      expect(config.schemas[0]!.schema).toBe('https://api.example.com/graphql')
      expect(config.schemas[0]!.output).toBe('./schema.d.ts')
    })

    it('returns config with extract options as-is', () => {
      const config = defineConfig({
        schemas: [{ schema: 'https://api.example.com/graphql', output: './schema.d.ts' }],
        extract: { dir: 'lib', algorithm: 'sha512', tsconfig: 'tsconfig.build.json' },
      })
      expect(config.extract?.dir).toBe('lib')
      expect(config.extract?.algorithm).toBe('sha512')
    })

    it('returns config array as-is', () => {
      const configs = defineConfig([
        { schemas: [{ schema: 'https://api.example.com/graphql', output: './schema-a.d.ts' }] },
        { schemas: [{ schema: { sdl: 'type Query { noop: String }' }, output: './schema-b.d.ts' }] },
      ])
      expect(Array.isArray(configs)).toBe(true)
      expect(configs).toHaveLength(2)
      expect(configs[0]!.schemas[0]!.output).toBe('./schema-a.d.ts')
      expect(configs[1]!.schemas[0]!.output).toBe('./schema-b.d.ts')
    })
  })

  describe('loadConfig', () => {
    let dir: string

    beforeEach(async () => {
      dir = join(tmpdir(), `gazania-test-${randomUUID()}`)
      await mkdir(dir, { recursive: true })
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
    })

    it('returns undefined when no config file exists', async () => {
      const result = await loadConfig(dir)
      expect(result).toBeUndefined()
    })

    it('loads single config as a one-element array', async () => {
      await writeFile(
        join(dir, 'gazania.config.js'),
        `export default { schemas: [{ schema: { sdl: '${SIMPLE_SDL}' }, output: './out.ts' }] }`,
      )
      const result = await loadConfig(dir)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result![0]!.schemas[0]!.output).toBe('./out.ts')
    })

    it('loads config with extract options', async () => {
      await writeFile(
        join(dir, 'gazania.config.js'),
        `export default { schemas: [{ schema: { sdl: '${SIMPLE_SDL}' }, output: './out.ts' }], extract: { dir: 'lib', tsconfig: 'tsconfig.build.json' } }`,
      )
      const result = await loadConfig(dir)
      expect(result).toHaveLength(1)
      expect(result![0]!.extract?.dir).toBe('lib')
      expect(result![0]!.extract?.tsconfig).toBe('tsconfig.build.json')
    })

    it('loads array config as-is', async () => {
      await writeFile(
        join(dir, 'gazania.config.js'),
        `export default [
        { schemas: [{ schema: { sdl: 'type Query { a: String }' }, output: './out-a.ts' }] },
        { schemas: [{ schema: { sdl: 'type Query { b: String }' }, output: './out-b.ts' }] },
      ]`,
      )
      const result = await loadConfig(dir)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(result![0]!.schemas[0]!.output).toBe('./out-a.ts')
      expect(result![1]!.schemas[0]!.output).toBe('./out-b.ts')
    })

    it('throws when config is missing schemas', async () => {
      await writeFile(
        join(dir, 'gazania.config.js'),
        `export default { output: './out.ts' }`,
      )
      await expect(loadConfig(dir)).rejects.toThrow('"schemas" field')
    })

    it('throws when schemas array is empty', async () => {
      await writeFile(
        join(dir, 'gazania.config.js'),
        `export default { schemas: [] }`,
      )
      await expect(loadConfig(dir)).rejects.toThrow('"schemas" field')
    })

    it('throws when array entries are missing schemas', async () => {
      await writeFile(
        join(dir, 'gazania.config.js'),
        `export default [{ output: './out.ts' }]`,
      )
      await expect(loadConfig(dir)).rejects.toThrow('invalid config array')
    })

    it('throws when schema entry has empty output', async () => {
      await writeFile(
        join(dir, 'gazania.config.js'),
        `export default { schemas: [{ schema: { sdl: '${SIMPLE_SDL}' }, output: '' }] }`,
      )
      await expect(loadConfig(dir)).rejects.toThrow('"schemas" field')
    })

    it('throws when schema entry has null schema', async () => {
      await writeFile(
        join(dir, 'gazania.config.js'),
        `export default { schemas: [{ schema: null, output: './out.ts' }] }`,
      )
      await expect(loadConfig(dir)).rejects.toThrow('"schemas" field')
    })
  })
}
