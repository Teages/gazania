import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../src/cli/config'
import { runGenerate } from '../src/cli/generate'

const SIMPLE_SDL = `type Query { hello: String }`

describe('loadConfig', () => {
  let dir: string

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-test-${Date.now()}`)
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

describe('runGenerate (multi-config)', () => {
  let dir: string
  const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-test-${Date.now()}`)
    await mkdir(dir, { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
    mockLog.mockClear()
  })

  it('generates multiple outputs from array config', async () => {
    await writeFile(
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
    await writeFile(
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
