import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extract } from '../../../src/extract'
import { loadTS, parseTSConfig } from '../../../src/extract/ts-program'

const sha256 = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`

async function createTempProject(): Promise<{ dir: string, getParsed: () => Promise<import('typescript').ParsedCommandLine> }> {
  const dir = join(tmpdir(), `gazania-type-aware-${randomUUID()}`)
  await mkdir(join(dir, 'src'), { recursive: true })

  await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'esnext',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      baseUrl: resolve(process.cwd()),
      paths: {
        gazania: ['src/index.ts'],
      },
    },
    include: ['src'],
  }))

  return {
    dir,
    async getParsed() {
      const ts = await loadTS()
      return parseTSConfig(ts, join(dir, 'tsconfig.json'), ts.sys)
    },
  }
}

describe('type-aware extract: object property access (schemas.anilist)', () => {
  let dir: string
  let getParsed: () => Promise<import('typescript').ParsedCommandLine>

  beforeEach(async () => {
    const project = await createTempProject()
    dir = project.dir
    getParsed = project.getParsed
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('extracts a query via schemas.anilist from an object holding gazania instances', async () => {
    await writeFile(
      join(dir, 'src', 'schemas.ts'),
      `import { createGazania } from 'gazania'
export const anilist = createGazania('https://graphql.anilist.co')
export const cytoid = createGazania('https://cytoid.level.com')
export const schemas = { anilist, cytoid }`,
    )
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { schemas } from './schemas'
const doc = schemas.anilist.query('GetAnime').select($ => $.select(['id', 'title']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetAnime')
    expect(manifest.operations.GetAnime.body).toContain('query GetAnime')
    expect(manifest.operations.GetAnime.body).toContain('id')
    expect(manifest.operations.GetAnime.body).toContain('title')
  })

  it('extracts a query via schemas.cytoid from an object holding gazania instances', async () => {
    await writeFile(
      join(dir, 'src', 'schemas.ts'),
      `import { createGazania } from 'gazania'
export const anilist = createGazania('https://graphql.anilist.co')
export const cytoid = createGazania('https://cytoid.level.com')
export const schemas = { anilist, cytoid }`,
    )
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { schemas } from './schemas'
const doc = schemas.cytoid.query('GetLevel').select($ => $.select(['id', 'name']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetLevel')
    expect(manifest.operations.GetLevel.body).toContain('query GetLevel')
  })

  it('extracts queries from multiple schemas in one project', async () => {
    await writeFile(
      join(dir, 'src', 'schemas.ts'),
      `import { createGazania } from 'gazania'
export const anilist = createGazania('https://graphql.anilist.co')
export const cytoid = createGazania('https://cytoid.level.com')
export const schemas = { anilist, cytoid }`,
    )
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { schemas } from './schemas'
const anime = schemas.anilist.query('GetAnime').select($ => $.select(['title']))
const level = schemas.cytoid.query('GetLevel').select($ => $.select(['name']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetAnime')
    expect(manifest.operations).toHaveProperty('GetLevel')
  })

  it('extracts a query via inline object property access', async () => {
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { createGazania } from 'gazania'
const schemas = { g: createGazania('https://example.com/graphql') }
const doc = schemas.g.query('InlineObj').select($ => $.select(['id']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('InlineObj')
  })
})

describe('type-aware extract: name shadowing (local var shadows global)', () => {
  let dir: string
  let getParsed: () => Promise<import('typescript').ParsedCommandLine>

  beforeEach(async () => {
    const project = await createTempProject()
    dir = project.dir
    getParsed = project.getParsed

    await writeFile(join(dir, 'src', 'auto-imports.d.ts'), [
      `import type { gazania } from 'gazania'`,
      `declare global {`,
      `  const schema: typeof gazania`,
      `}`,
      `export {}`,
    ].join('\n'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('does not extract a query from a local variable that shadows a global gazania builder', async () => {
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `const schema = { select: (cb: any) => ({ type: 'custom', ...cb() }) }
const result = schema.select(() => ['field'])`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(Object.keys(manifest.operations)).toHaveLength(0)
    expect(Object.keys(manifest.fragments)).toHaveLength(0)
  })

  it('still extracts gazania queries when global is not shadowed', async () => {
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `const doc = schema.query('GlobalQuery').select($ => $.select(['id']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GlobalQuery')
  })

  it('extracts gazania query and ignores shadowed variable in the same file', async () => {
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `const doc1 = schema.query('RealQuery').select($ => $.select(['id']))
const schema = { select: (cb: any) => ({ type: 'custom' }) }
const result = schema.select(() => ['field'])`,
    )
    const parsed = await getParsed()
    const { manifest, skipped } = await extract({
      dir: join(dir, 'src'),
      hash: sha256,
      tsconfig: parsed,
      ignoreCategories: ['analysis', 'unresolved'],
    })
    expect(manifest.operations).toHaveProperty('RealQuery')
  })
})
