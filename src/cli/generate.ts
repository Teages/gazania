import type { Config, SchemaLoader } from './config'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { cwd as getCwd } from 'node:process'
import { generate } from '../codegen'
import { loadConfig } from './config'
import { resolveSchema } from './loader'

export interface GenerateCommandOptions {
  schema?: string
  output?: string
  config?: string
  silent?: boolean
  cwd?: string
}

export async function runGenerate(options: GenerateCommandOptions = {}): Promise<void> {
  const { silent = false, cwd = getCwd() } = options
  const log = makeLogger(silent)

  let configs: Config[]

  if (options.schema && options.output) {
    // Fully specified via CLI flags — no config file needed
    configs = [{ schema: options.schema, output: options.output }]
  }
  else {
    const configCwd = options.config ? dirname(resolve(options.config)) : cwd
    const loaded = await loadConfig(configCwd)

    if (!loaded) {
      if (options.schema || options.output) {
        throw new Error(
          'No config file found. Provide both --schema and --output, or create a gazania.config.ts/js file.',
        )
      }
      throw new Error(
        'No config file found. Create a gazania.config.ts or gazania.config.js file, '
        + 'or specify --schema and --output on the command line.',
      )
    }

    configs = loaded

    // CLI flags override: only allowed with single config
    if (options.schema || options.output) {
      if (configs.length > 1) {
        throw new Error(
          'Cannot use --schema or --output flags when config file defines multiple schemas.',
        )
      }
      if (options.schema) {
        configs = [{ ...configs[0]!, schema: options.schema }]
      }
      if (options.output) {
        configs = [{ ...configs[0]!, output: options.output }]
      }
    }
  }

  for (const config of configs) {
    await generateOne(config, { cwd, log })
  }
}

async function generateOne(
  config: Config,
  { cwd, log }: { cwd: string, log: (msg: string) => void },
): Promise<void> {
  const source: SchemaLoader = config.schema
  const outputPath = resolve(cwd, config.output)
  const url = typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'))
    ? source
    : typeof source === 'object' && 'url' in source
      ? source.url
      : undefined

  log(`Generating schema types...`)

  const sdl = await resolveSchema(source)
  const code = generate(sdl, { scalars: config.scalars, url })

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, code, 'utf-8')

  log(`Schema types written to ${outputPath}`)
}

function makeLogger(silent: boolean): (msg: string) => void {
  return silent ? () => {} : (msg: string) => console.log(msg)
}

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach, afterEach, vi } = import.meta.vitest
  const { mkdir: mkdirTest, rm, writeFile: writeFileTest } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { randomUUID } = await import('node:crypto')

  describe('runGenerate (multi-config)', () => {
    let dir: string
    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    beforeEach(async () => {
      dir = join(tmpdir(), `gazania-test-${randomUUID()}`)
      await mkdirTest(dir, { recursive: true })
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
      mockLog.mockClear()
    })

    it('generates multiple outputs from array config', async () => {
      await writeFileTest(
        join(dir, 'gazania.config.js'),
        `export default [
        { schema: { sdl: 'type Query { a: String }' }, output: 'out-a.ts' },
        { schema: { sdl: 'type Query { b: String }' }, output: 'out-b.ts' },
      ]`,
      )
      await runGenerate({ cwd: dir })

      const { existsSync } = await import('node:fs')
      expect(existsSync(join(dir, 'out-a.ts'))).toBe(true)
      expect(existsSync(join(dir, 'out-b.ts'))).toBe(true)
    })

    it('throws when --schema or --output is used with multi-config file', async () => {
      await writeFileTest(
        join(dir, 'gazania.config.js'),
        `export default [
        { schema: { sdl: 'type Query { a: String }' }, output: 'out-a.ts' },
        { schema: { sdl: 'type Query { b: String }' }, output: 'out-b.ts' },
      ]`,
      )
      await expect(
        runGenerate({ cwd: dir, output: 'override.ts' }),
      ).rejects.toThrow('Cannot use --schema or --output flags when config file defines multiple schemas.')
    })
  })
}
