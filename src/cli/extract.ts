import type { SkippedExtractionCategory } from '../extract/manifest'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { env, stderr, stdout } from 'node:process'
import { buildASTSchema, parse } from 'graphql'
import { extract } from '../extract'
import { ExtractionError } from '../extract/manifest'
import { loadTS, parseTSConfig } from '../extract/ts-program'
import { validateManifest } from '../extract/validate'
import { resolveSchema } from './loader'

export type { ExtractManifest, ExtractResult, ManifestEntry, SkippedExtraction } from '../extract'

export interface ExtractCommandOptions {
  dir: string
  output: string | null
  noEmit: boolean
  include: string
  algorithm: string
  silent: boolean
  cwd: string
  tsconfig?: string
  ignoreCategories?: SkippedExtractionCategory[]
  schema?: string
  strict?: boolean
}

/**
 * Run the extract CLI command.
 * Delegates to the core `extract()` function and writes the manifest to disk.
 */
export async function runExtract(options: ExtractCommandOptions): Promise<void> {
  const { dir, output, noEmit, include, algorithm, silent, cwd, tsconfig, ignoreCategories, schema, strict } = options
  const log = silent ? () => {} : (msg: string) => stderr.write(`${msg}\n`)
  const warn = (msg: string) => stderr.write(`${msg}\n`)

  if (!tsconfig) {
    throw new Error('--tsconfig is required. Usage: gazania extract --dir src --tsconfig tsconfig.json')
  }

  if (strict && !schema) {
    throw new Error('--strict requires --schema')
  }

  const scanDir = join(cwd, dir)
  log(`Scanning ${relative(cwd, scanDir) || '.'}...`)

  let manifest
  try {
    const ts = await loadTS()
    const tsconfigPath = join(cwd, tsconfig)
    const parsed = parseTSConfig(ts, tsconfigPath, ts.sys)
    const hash = (body: string) => {
      const hex = createHash(algorithm).update(body).digest('hex')
      return `${algorithm}:${hex}`
    }
    const result = await extract({ dir: scanDir, include, hash, tsconfig: parsed, ignoreCategories, logger: { debug: env.GAZANIA_DEBUG === '1' ? (msg: any) => stderr.write(`${msg}\n`) : () => {}, warn: (msg: any) => stderr.write(`${msg}\n`), error: (msg: any) => stderr.write(`${msg}\n`) } })
    manifest = result.manifest
  }
  catch (err) {
    if (err instanceof ExtractionError) {
      const skipped = err.skipped
      warn(``)
      warn(`⚠ ${skipped.length} Gazania call(s) were detected but could not be extracted:`)
      for (const entry of skipped) {
        const filePath = relative(cwd, entry.file) || entry.file
        warn(``)
        warn(`  ${filePath}:${entry.line}`)
        warn(`    Reason: ${entry.reason}`)

        if (entry.category === 'unresolved' && entry.reason.includes('is not defined')) {
          warn(`    Possible cause: the referenced variable is not exported or not included in tsconfig`)
          warn(`    Fix: ensure the partial/section is exported and its file is covered by tsconfig "include"`)
        }
        else {
          warn(`    Possible cause: builder chain depends on a runtime value`)
          warn(`    Fix: ensure all values used in the builder chain are compile-time constants`)
        }
      }
      warn(``)
      throw err
    }
    throw err
  }

  if (schema) {
    const sdl = await resolveSchema(schema)
    const gqlSchema = buildASTSchema(parse(sdl))
    const { errors, warnings } = validateManifest(manifest, gqlSchema)

    if (errors.length > 0) {
      for (const e of errors) {
        warn(`✗ ${relative(cwd, e.file) || e.file}:${e.line} ${e.message}`)
      }
      for (const w of warnings) {
        warn(`⚠ ${relative(cwd, w.file) || w.file}:${w.line} ${w.message}`)
      }
      throw new Error(`GraphQL validation failed with ${errors.length} error(s)`)
    }

    for (const w of warnings) {
      warn(`⚠ ${relative(cwd, w.file) || w.file}:${w.line} ${w.message}`)
    }

    if (strict && warnings.length > 0) {
      throw new Error(`GraphQL validation failed with ${warnings.length} warning(s) in strict mode`)
    }
  }

  const totalFound
    = Object.keys(manifest.operations).length
      + Object.keys(manifest.fragments).length

  log(`Extracted ${totalFound} GraphQL document(s).`)

  if (!noEmit) {
    if (output === null || output === '-') {
      stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
    }
    else {
      const outputPath = isAbsolute(output) ? output : join(cwd, output)
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
      log(`Manifest written to ${relative(cwd, outputPath)}`)
    }
  }
}

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach, afterEach, vi } = import.meta.vitest

  describe('runExtract', async () => {
    const { existsSync } = await import('node:fs')
    const { mkdir: mkdirTest, readFile: readFileTest, rm, writeFile: writeFileTest } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { resolve } = await import('node:path')
    const { cwd: getCwd } = await import('node:process')
    const { randomUUID } = await import('node:crypto')

    let dir: string
    const mockStderr = vi.spyOn(stderr, 'write').mockImplementation((() => true) as any)

    beforeEach(async () => {
      dir = join(tmpdir(), `gazania-cli-extract-test-${randomUUID()}`)
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
      mockStderr.mockClear()
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
        noEmit: false,
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
        noEmit: false,
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
        noEmit: false,
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(mockStderr).toHaveBeenCalled()
    })

    it('emits no warnings when there are no skipped calls', async () => {
      mockStderr.mockClear()

      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('Ok').select($ => $.select(['id']))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        noEmit: false,
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      const stderrCalls = mockStderr.mock.calls.map(c => c[0] as string)
      expect(stderrCalls.some((msg: string) => msg.includes('⚠'))).toBe(false)
    })

    it('emits warnings to stderr when calls are skipped', async () => {
      mockStderr.mockClear()

      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('Fail').select($ => $.select([...missing({})]))`,
      )

      await expect(runExtract({
        dir: 'src',
        output: 'manifest.json',
        noEmit: false,
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })).rejects.toThrow()

      const stderrCalls = mockStderr.mock.calls.map(c => c[0] as string)
      expect(stderrCalls.some((msg: string) => msg.includes('⚠'))).toBe(true)
      expect(stderrCalls.some((msg: string) => msg.includes('1 Gazania call(s)'))).toBe(true)
      expect(stderrCalls.some((msg: string) => msg.includes('src/query.js:2'))).toBe(true)
      expect(stderrCalls.some((msg: string) => msg.includes('missing is not defined'))).toBe(true)
    })

    it('emits warnings in silent mode when calls are skipped', async () => {
      mockStderr.mockClear()

      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('Fail').select($ => $.select([...missing({})]))`,
      )

      await expect(runExtract({
        dir: 'src',
        output: 'manifest.json',
        noEmit: false,
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })).rejects.toThrow()

      const stderrCalls = mockStderr.mock.calls.map(c => c[0] as string)
      // silent suppresses progress logs, but warnings are still emitted
      expect(stderrCalls.some((msg: string) => msg.includes('Scanning'))).toBe(false)
      expect(stderrCalls.some((msg: string) => msg.includes('Extracted'))).toBe(false)
      expect(stderrCalls.some((msg: string) => msg.includes('⚠'))).toBe(true)
    })

    it('throws when --tsconfig is not provided', async () => {
      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('Fail').select($ => $.select([...crossFilePartial({})]))`,
      )

      await expect(runExtract({
        dir: 'src',
        output: 'manifest.json',
        noEmit: false,
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
      })).rejects.toThrow('tsconfig is required')
    })

    it('ignoreCategories suppresses ExtractionError at CLI level', async () => {
      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('Ignored').select($ => $.select([...missing({})]))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        noEmit: false,
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
        tsconfig: 'tsconfig.json',
        ignoreCategories: ['unresolved'],
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations).not.toHaveProperty('Ignored')
    })

    it('writes manifest JSON to stdout when output is null', async () => {
      const mockStdout = vi.spyOn(stdout, 'write').mockImplementation((() => true) as any)

      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('StdoutQuery').select($ => $.select(['id']))`,
      )

      try {
        await runExtract({
          dir: 'src',
          output: null,
          noEmit: false,
          include: '**/*.{ts,tsx,js,jsx}',
          algorithm: 'sha256',
          silent: true,
          cwd: dir,
          tsconfig: 'tsconfig.json',
        })

        const stdoutCalls = mockStdout.mock.calls.map(c => c[0] as string)
        const jsonOutput = stdoutCalls.join('')
        const manifest = JSON.parse(jsonOutput)
        expect(manifest.operations).toHaveProperty('StdoutQuery')
      }
      finally {
        mockStdout.mockRestore()
      }
    })

    it('shows runtime value fix hint when error is not a ReferenceError', async () => {
      mockStderr.mockClear()

      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const notAFn = 42
const doc = gazania.query('Fail').select($ => $.select([...notAFn({})]))`,
      )

      await expect(runExtract({
        dir: 'src',
        output: 'manifest.json',
        noEmit: false,
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })).rejects.toThrow()

      const stderrCalls = mockStderr.mock.calls.map(c => c[0] as string)
      expect(stderrCalls.some((msg: string) => msg.includes('compile-time constants'))).toBe(true)
    })

    describe('--schema validation', () => {
      it('--schema with valid query → resolves without error', async () => {
        mockStderr.mockClear()

        await writeFileTest(join(dir, 'schema.graphql'), `
          type Query {
            id: ID
            name: String
          }
        `)
        await writeFileTest(
          join(dir, 'src', 'query.js'),
          `import { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select(['id', 'name']))`,
        )

        await expect(runExtract({
          dir: 'src',
          output: 'manifest.json',
          noEmit: true,
          include: '**/*.{ts,tsx,js,jsx}',
          algorithm: 'sha256',
          silent: true,
          cwd: dir,
          tsconfig: 'tsconfig.json',
          schema: join(dir, 'schema.graphql'),
          strict: false,
        })).resolves.toBeUndefined()

        const stderrCalls = mockStderr.mock.calls.map(c => c[0] as string)
        expect(stderrCalls.some((msg: string) => msg.includes('✗'))).toBe(false)
      })

      it('--schema with invalid field → throws with error on stderr', async () => {
        mockStderr.mockClear()

        await writeFileTest(join(dir, 'schema.graphql'), `
          type Query {
            id: ID
          }
        `)
        await writeFileTest(
          join(dir, 'src', 'query.js'),
          `import { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select(['id', 'name']))`,
        )

        await expect(runExtract({
          dir: 'src',
          output: 'manifest.json',
          noEmit: true,
          include: '**/*.{ts,tsx,js,jsx}',
          algorithm: 'sha256',
          silent: true,
          cwd: dir,
          tsconfig: 'tsconfig.json',
          schema: join(dir, 'schema.graphql'),
          strict: false,
        })).rejects.toThrow()

        const stderrCalls = mockStderr.mock.calls.map(c => c[0] as string)
        expect(stderrCalls.some((msg: string) => msg.includes('✗'))).toBe(true)
      })

      it('--schema with deprecated field (no --strict) → warns but does not throw', async () => {
        mockStderr.mockClear()

        await writeFileTest(join(dir, 'schema.graphql'), `
          type Query {
            id: ID
            oldField: String @deprecated(reason: "use id")
          }
        `)
        await writeFileTest(
          join(dir, 'src', 'query.js'),
          `import { gazania } from 'gazania'\nconst doc = gazania.query('DepQuery').select($ => $.select(['id', 'oldField']))`,
        )

        await expect(runExtract({
          dir: 'src',
          output: 'manifest.json',
          noEmit: true,
          include: '**/*.{ts,tsx,js,jsx}',
          algorithm: 'sha256',
          silent: true,
          cwd: dir,
          tsconfig: 'tsconfig.json',
          schema: join(dir, 'schema.graphql'),
          strict: false,
        })).resolves.toBeUndefined()

        const stderrCalls = mockStderr.mock.calls.map(c => c[0] as string)
        expect(stderrCalls.some((msg: string) => msg.includes('⚠'))).toBe(true)
      })

      it('--schema + --strict with deprecated field → throws', async () => {
        mockStderr.mockClear()

        await writeFileTest(join(dir, 'schema.graphql'), `
          type Query {
            id: ID
            oldField: String @deprecated(reason: "use id")
          }
        `)
        await writeFileTest(
          join(dir, 'src', 'query.js'),
          `import { gazania } from 'gazania'\nconst doc = gazania.query('DepQuery').select($ => $.select(['id', 'oldField']))`,
        )

        await expect(runExtract({
          dir: 'src',
          output: 'manifest.json',
          noEmit: true,
          include: '**/*.{ts,tsx,js,jsx}',
          algorithm: 'sha256',
          silent: true,
          cwd: dir,
          tsconfig: 'tsconfig.json',
          schema: join(dir, 'schema.graphql'),
          strict: true,
        })).rejects.toThrow()
      })

      it('--schema with non-existent file → throws', async () => {
        await writeFileTest(
          join(dir, 'src', 'query.js'),
          `import { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select(['id']))`,
        )

        await expect(runExtract({
          dir: 'src',
          output: 'manifest.json',
          noEmit: true,
          include: '**/*.{ts,tsx,js,jsx}',
          algorithm: 'sha256',
          silent: true,
          cwd: dir,
          tsconfig: 'tsconfig.json',
          schema: join(dir, 'nonexistent.graphql'),
          strict: false,
        })).rejects.toThrow()
      })

      it('--noEmit + --schema → no file written, validation runs', async () => {
        const { existsSync } = await import('node:fs')

        await writeFileTest(join(dir, 'schema.graphql'), `
          type Query { id: ID }
        `)
        await writeFileTest(
          join(dir, 'src', 'query.js'),
          `import { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select(['id']))`,
        )

        await runExtract({
          dir: 'src',
          output: 'manifest.json',
          noEmit: true,
          include: '**/*.{ts,tsx,js,jsx}',
          algorithm: 'sha256',
          silent: true,
          cwd: dir,
          tsconfig: 'tsconfig.json',
          schema: join(dir, 'schema.graphql'),
          strict: false,
        })

        expect(existsSync(join(dir, 'manifest.json'))).toBe(false)
      })

      it('--schema without --noEmit → manifest written AND validation runs', async () => {
        const { existsSync } = await import('node:fs')

        await writeFileTest(join(dir, 'schema.graphql'), `
          type Query { id: ID }
        `)
        await writeFileTest(
          join(dir, 'src', 'query.js'),
          `import { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select(['id']))`,
        )

        await runExtract({
          dir: 'src',
          output: 'manifest.json',
          noEmit: false,
          include: '**/*.{ts,tsx,js,jsx}',
          algorithm: 'sha256',
          silent: true,
          cwd: dir,
          tsconfig: 'tsconfig.json',
          schema: join(dir, 'schema.graphql'),
          strict: false,
        })

        expect(existsSync(join(dir, 'manifest.json'))).toBe(true)
      })

      it('no --schema → existing behavior unchanged, no validation output', async () => {
        mockStderr.mockClear()

        await writeFileTest(
          join(dir, 'src', 'query.js'),
          `import { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select(['id']))`,
        )

        await runExtract({
          dir: 'src',
          output: 'manifest.json',
          noEmit: true,
          include: '**/*.{ts,tsx,js,jsx}',
          algorithm: 'sha256',
          silent: true,
          cwd: dir,
          tsconfig: 'tsconfig.json',
        })

        const stderrCalls = mockStderr.mock.calls.map(c => c[0] as string)
        expect(stderrCalls.some((msg: string) => msg.includes('✗'))).toBe(false)
        expect(stderrCalls.some((msg: string) => msg.includes('validation'))).toBe(false)
      })

      it('--strict without --schema → throws', async () => {
        await writeFileTest(
          join(dir, 'src', 'query.js'),
          `import { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select(['id']))`,
        )

        await expect(runExtract({
          dir: 'src',
          output: 'manifest.json',
          noEmit: true,
          include: '**/*.{ts,tsx,js,jsx}',
          algorithm: 'sha256',
          silent: true,
          cwd: dir,
          tsconfig: 'tsconfig.json',
          strict: true,
        })).rejects.toThrow('--strict requires --schema')
      })
    })
  })
}
