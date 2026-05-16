import type { Config } from '../codegen/config'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd as getCwd } from 'node:process'
import { pathToFileURL } from 'node:url'

const CONFIG_CANDIDATES = ['gazania.config.ts', 'gazania.config.js']

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
      if (mod.default.length === 0 || !mod.default.every(item => typeof item === 'object' && item !== null && 'schema' in item && 'output' in item)) {
        throw new Error(
          `Config file "${filePath}" exports an invalid config array. Each entry must have "schema" and "output" fields.`,
        )
      }
      return mod.default as Config[]
    }

    if (!('schema' in mod.default) || !('output' in mod.default)) {
      throw new Error(
        `Config file "${filePath}" must export a default config object or array. Use defineConfig() from 'gazania/config'.`,
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
        `export default { schema: { sdl: '${SIMPLE_SDL}' }, output: './out.ts' }`,
      )
      const result = await loadConfig(dir)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result![0]!.output).toBe('./out.ts')
    })

    it('loads array config as-is', async () => {
      await writeFile(
        join(dir, 'gazania.config.js'),
        `export default [
        { schema: { sdl: 'type Query { a: String }' }, output: './out-a.ts' },
        { schema: { sdl: 'type Query { b: String }' }, output: './out-b.ts' },
      ]`,
      )
      const result = await loadConfig(dir)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(result![0]!.output).toBe('./out-a.ts')
      expect(result![1]!.output).toBe('./out-b.ts')
    })

    it('throws when array entries are missing required fields', async () => {
      await writeFile(
        join(dir, 'gazania.config.js'),
        `export default [{ output: './out.ts' }]`,
      )
      await expect(loadConfig(dir)).rejects.toThrow('invalid config array')
    })
  })
}
