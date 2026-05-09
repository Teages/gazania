import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { extract } from '../extract'

export type { ExtractManifest, ExtractResult, ManifestEntry, SkippedExtraction } from '../extract'

export interface ExtractCommandOptions {
  dir: string
  output: string
  include: string
  algorithm: string
  silent: boolean
  cwd: string
  tsconfig?: string
}

/**
 * Run the extract CLI command.
 * Delegates to the core `extract()` function and writes the manifest to disk.
 */
export async function runExtract(options: ExtractCommandOptions): Promise<void> {
  const { dir, output, include, algorithm, silent, cwd, tsconfig } = options
  const log = silent ? () => {} : (msg: string) => console.log(msg)
  const warn = silent ? () => {} : (msg: string) => console.warn(msg)

  if (!tsconfig) {
    throw new Error('--tsconfig is required. Usage: gazania extract --dir src --tsconfig tsconfig.json')
  }

  const scanDir = join(cwd, dir)
  log(`Scanning ${relative(cwd, scanDir) || '.'}...`)

  const { manifest, skipped } = await extract({ dir, include, algorithm, cwd, tsconfig })

  const totalFound
    = Object.keys(manifest.operations).length
      + Object.keys(manifest.fragments).length

  log(`Extracted ${totalFound} GraphQL document(s).`)

  if (skipped.length > 0) {
    warn(``)
    warn(`⚠ ${skipped.length} Gazania call(s) were detected but could not be extracted:`)
    for (const entry of skipped) {
      const filePath = relative(cwd, entry.file) || entry.file
      warn(``)
      warn(`  ${filePath}:${entry.line}`)
      warn(`    Reason: ${entry.reason}`)

      const isReferenceError = entry.reason.includes('is not defined')
      if (isReferenceError) {
        warn(`    Possible cause: the referenced variable is not exported or not included in tsconfig`)
        warn(`    Fix: ensure the partial/section is exported and its file is covered by tsconfig "include"`)
      }
      else {
        warn(`    Possible cause: builder chain depends on a runtime value`)
        warn(`    Fix: ensure all values used in the builder chain are compile-time constants`)
      }
    }
    warn(``)
  }

  const outputPath = join(cwd, output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')

  log(`Manifest written to ${outputPath}`)
}

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach, afterEach, vi } = import.meta.vitest

  describe('runExtract', async () => {
    const { existsSync } = await import('node:fs')
    const { mkdir: mkdirTest, readFile: readFileTest, rm, writeFile: writeFileTest } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { resolve } = await import('node:path')
    const { cwd: getCwd } = await import('node:process')

    let dir: string
    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    beforeEach(async () => {
      dir = join(tmpdir(), `gazania-cli-extract-test-${Date.now()}`)
      await mkdirTest(dir, { recursive: true })
      await mkdirTest(join(dir, 'src'), { recursive: true })

      await writeFileTest(join(dir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'esnext',
          module: 'esnext',
          moduleResolution: 'bundler',
          baseUrl: resolve(getCwd()),
          paths: {
            gazania: ['src/index.ts'],
          },
        },
        include: ['src'],
      }))
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
      mockLog.mockClear()
    })

    it('writes manifest to output file', async () => {
      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const doc = gazania.query('CliQuery').select($ => $.select(['id']))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations).toHaveProperty('CliQuery')
    })

    it('creates output directory if needed', async () => {
      await writeFileTest(join(dir, 'src', 'index.js'), `const x = 1`)

      await runExtract({
        dir: 'src',
        output: 'nested/dir/manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(existsSync(join(dir, 'nested', 'dir', 'manifest.json'))).toBe(true)
    })

    it('logs output when not silent', async () => {
      await writeFileTest(join(dir, 'src', 'index.js'), `const x = 1`)

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(mockLog).toHaveBeenCalled()
    })

    it('emits no warnings when there are no skipped calls', async () => {
      const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('Ok').select($ => $.select(['id']))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(mockWarn).not.toHaveBeenCalled()
      mockWarn.mockRestore()
    })

    it('emits warnings to console.warn when calls are skipped', async () => {
      const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('Fail').select($ => $.select([...missing({})]))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      const warnCalls = mockWarn.mock.calls.map(c => c[0])
      expect(warnCalls.some((msg: string) => msg.includes('⚠'))).toBe(true)
      expect(warnCalls.some((msg: string) => msg.includes('1 Gazania call(s)'))).toBe(true)
      expect(warnCalls.some((msg: string) => msg.includes('src/query.js:2'))).toBe(true)
      expect(warnCalls.some((msg: string) => msg.includes('missing is not defined'))).toBe(true)
      mockWarn.mockRestore()
    })

    it('suppresses warnings in silent mode even when calls are skipped', async () => {
      const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('Fail').select($ => $.select([...missing({})]))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(mockWarn).not.toHaveBeenCalled()
      mockWarn.mockRestore()
    })

    it('throws when --tsconfig is not provided', async () => {
      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('Fail').select($ => $.select([...crossFilePartial({})]))`,
      )

      await expect(runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
      })).rejects.toThrow('tsconfig is required')
    })

    it('shows runtime value fix hint when error is not a ReferenceError', async () => {
      const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const notAFn = 42
const doc = gazania.query('Fail').select($ => $.select([...notAFn({})]))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      const warnCalls = mockWarn.mock.calls.map(c => c[0])
      expect(warnCalls.some((msg: string) => msg.includes('compile-time constants'))).toBe(true)
      mockWarn.mockRestore()
    })
  })
}
