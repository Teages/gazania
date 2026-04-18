import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runExtract } from '../src/cli/extract'

describe('runExtract', () => {
  let dir: string
  const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-extract-test-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    await mkdir(join(dir, 'src'), { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
    mockLog.mockClear()
  })

  it('generates an empty manifest when no gazania files found', async () => {
    await writeFile(
      join(dir, 'src', 'index.js'),
      `const x = 1`,
    )

    await runExtract({
      dir: 'src',
      output: 'manifest.json',
      include: '**/*.{ts,tsx,js,jsx}',
      algorithm: 'sha256',
      silent: true,
      cwd: dir,
    })

    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'))
    expect(manifest.operations).toEqual({})
    expect(manifest.fragments).toEqual({})
  })

  it('extracts a simple query from a JS file', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('TestQuery')
  .select($ => $.select(['id', 'name']))`,
    )

    await runExtract({
      dir: 'src',
      output: 'manifest.json',
      include: '**/*.{ts,tsx,js,jsx}',
      algorithm: 'sha256',
      silent: true,
      cwd: dir,
    })

    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'))
    expect(manifest.operations).toHaveProperty('TestQuery')
    expect(manifest.operations.TestQuery.body).toContain('query TestQuery')
    expect(manifest.operations.TestQuery.body).toContain('id')
    expect(manifest.operations.TestQuery.body).toContain('name')
    expect(manifest.operations.TestQuery.hash).toMatch(/^sha256:/)
  })

  it('extracts a mutation', async () => {
    await writeFile(
      join(dir, 'src', 'mutation.js'),
      `import { gazania } from 'gazania'
const doc = gazania.mutation('CreateUser')
  .vars({ input: 'CreateUserInput!' })
  .select(($, vars) => $.select([{
    createUser: $ => $.args({ input: vars.input }).select(['id', 'name']),
  }]))`,
    )

    await runExtract({
      dir: 'src',
      output: 'manifest.json',
      include: '**/*.{ts,tsx,js,jsx}',
      algorithm: 'sha256',
      silent: true,
      cwd: dir,
    })

    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'))
    expect(manifest.operations).toHaveProperty('CreateUser')
    expect(manifest.operations.CreateUser.body).toContain('mutation CreateUser')
  })

  it('extracts a fragment', async () => {
    await writeFile(
      join(dir, 'src', 'fragment.js'),
      `import { gazania } from 'gazania'
const doc = gazania.fragment('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))`,
    )

    await runExtract({
      dir: 'src',
      output: 'manifest.json',
      include: '**/*.{ts,tsx,js,jsx}',
      algorithm: 'sha256',
      silent: true,
      cwd: dir,
    })

    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'))
    expect(manifest.fragments).toHaveProperty('UserFields')
    expect(manifest.fragments.UserFields.body).toContain('fragment UserFields on User')
  })

  it('extracts multiple queries from multiple files', async () => {
    await writeFile(
      join(dir, 'src', 'a.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('QueryA').select($ => $.select(['fieldA']))`,
    )
    await writeFile(
      join(dir, 'src', 'b.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('QueryB').select($ => $.select(['fieldB']))`,
    )

    await runExtract({
      dir: 'src',
      output: 'manifest.json',
      include: '**/*.{ts,tsx,js,jsx}',
      algorithm: 'sha256',
      silent: true,
      cwd: dir,
    })

    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'))
    expect(manifest.operations).toHaveProperty('QueryA')
    expect(manifest.operations).toHaveProperty('QueryB')
  })

  it('creates output directory if needed', async () => {
    await writeFile(
      join(dir, 'src', 'index.js'),
      `const x = 1`,
    )

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
    await writeFile(
      join(dir, 'src', 'index.js'),
      `const x = 1`,
    )

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

  it('handles files that cannot be parsed', async () => {
    await writeFile(
      join(dir, 'src', 'broken.js'),
      `this is not valid javascript {{{`,
    )

    // Should not throw
    await runExtract({
      dir: 'src',
      output: 'manifest.json',
      include: '**/*.{ts,tsx,js,jsx}',
      algorithm: 'sha256',
      silent: true,
      cwd: dir,
    })

    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'))
    expect(manifest.operations).toEqual({})
  })

  it('supports different hash algorithms', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('TestQuery')
  .select($ => $.select(['id']))`,
    )

    await runExtract({
      dir: 'src',
      output: 'manifest.json',
      include: '**/*.{ts,tsx,js,jsx}',
      algorithm: 'md5',
      silent: true,
      cwd: dir,
    })

    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'))
    expect(manifest.operations.TestQuery.hash).toMatch(/^md5:/)
  })
})
