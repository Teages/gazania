import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { extract } from '../extract'

export type { ExtractManifest, ManifestEntry } from '../extract'

export interface ExtractCommandOptions {
  dir: string
  output: string
  include: string
  algorithm: string
  silent: boolean
  cwd: string
}

/**
 * Run the extract CLI command.
 * Delegates to the core `extract()` function and writes the manifest to disk.
 */
export async function runExtract(options: ExtractCommandOptions): Promise<void> {
  const { dir, output, include, algorithm, silent, cwd } = options
  const log = silent ? () => {} : (msg: string) => console.log(msg)

  const scanDir = join(cwd, dir)
  log(`Scanning ${relative(cwd, scanDir) || '.'}...`)

  const manifest = await extract({ dir, include, algorithm, cwd })

  const totalFound
    = Object.keys(manifest.operations).length
    + Object.keys(manifest.fragments).length

  log(`Extracted ${totalFound} GraphQL document(s).`)

  const outputPath = join(cwd, output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')

  log(`Manifest written to ${outputPath}`)
}

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach, afterEach, vi } = import.meta.vitest
  const { existsSync } = await import('node:fs')
  const { mkdir: mkdirTest, readFile: readFileTest, rm, writeFile: writeFileTest } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')

  describe('runExtract', () => {
    let dir: string
    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    beforeEach(async () => {
      dir = join(tmpdir(), `gazania-cli-extract-test-${Date.now()}`)
      await mkdirTest(dir, { recursive: true })
      await mkdirTest(join(dir, 'src'), { recursive: true })
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
      })

      expect(mockLog).toHaveBeenCalled()
    })
  })
}
