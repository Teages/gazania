import type { Config } from '../codegen/schema'
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
        `Config file "${filePath}" must export a default config object or array. Use defineConfig() from 'gazania/codegen'.`,
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
        `Config file "${filePath}" must export a default config object or array. Use defineConfig() from 'gazania/codegen'.`,
      )
    }

    return [mod.default as Config]
  }

  return undefined
}
