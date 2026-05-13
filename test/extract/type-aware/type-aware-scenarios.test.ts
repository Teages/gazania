import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extract } from '../../../src/extract'
import { createHostFromSystem, loadTS, parseTSConfig } from '../../../src/extract/ts-program'
import { createTestingSystem } from '../../utils/vfs'

const sha256 = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`

const ts = await loadTS()
const projectRoot = resolve(process.cwd())

function makeTSConfig() {
  return JSON.stringify({
    compilerOptions: {
      target: 'esnext',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      baseUrl: projectRoot,
      paths: {
        gazania: ['src/index.ts'],
      },
    },
    include: ['src'],
  })
}

function extractWithSystem(
  system: import('typescript').System,
  opts: Omit<import('../../../src/extract').ExtractOptions, 'createHost' | 'fs'>,
) {
  return extract({
    ...opts,
    fs: system,
    createHost: (_ts, _sys, options) => createHostFromSystem(_ts, system, options),
  })
}

describe('type-aware extract: object property access (schemas.anilist)', () => {
  const baseDir = '/vfs/ta-scenarios'

  it('extracts a query via schemas.anilist from an object holding gazania instances', async () => {
    const files: Record<string, string> = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/schemas.ts`]: `import { createGazania } from 'gazania'
export const anilist = createGazania('https://graphql.anilist.co')
export const cytoid = createGazania('https://cytoid.level.com')
export const schemas = { anilist, cytoid }`,
      [`${baseDir}/src/query.ts`]: `import { schemas } from './schemas'
const doc = schemas.anilist.query('GetAnime').select($ => $.select(['id', 'title']))`,
    }
    const system = createTestingSystem(files, ts)
    const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
    const { manifest } = await extractWithSystem(system, { dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetAnime')
    expect(manifest.operations.GetAnime.body).toContain('query GetAnime')
    expect(manifest.operations.GetAnime.body).toContain('id')
    expect(manifest.operations.GetAnime.body).toContain('title')
  })

  it('extracts a query via schemas.cytoid from an object holding gazania instances', async () => {
    const files: Record<string, string> = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/schemas.ts`]: `import { createGazania } from 'gazania'
export const anilist = createGazania('https://graphql.anilist.co')
export const cytoid = createGazania('https://cytoid.level.com')
export const schemas = { anilist, cytoid }`,
      [`${baseDir}/src/query.ts`]: `import { schemas } from './schemas'
const doc = schemas.cytoid.query('GetLevel').select($ => $.select(['id', 'name']))`,
    }
    const system = createTestingSystem(files, ts)
    const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
    const { manifest } = await extractWithSystem(system, { dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetLevel')
    expect(manifest.operations.GetLevel.body).toContain('query GetLevel')
  })

  it('extracts queries from multiple schemas in one project', async () => {
    const files: Record<string, string> = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/schemas.ts`]: `import { createGazania } from 'gazania'
export const anilist = createGazania('https://graphql.anilist.co')
export const cytoid = createGazania('https://cytoid.level.com')
export const schemas = { anilist, cytoid }`,
      [`${baseDir}/src/query.ts`]: `import { schemas } from './schemas'
const anime = schemas.anilist.query('GetAnime').select($ => $.select(['title']))
const level = schemas.cytoid.query('GetLevel').select($ => $.select(['name']))`,
    }
    const system = createTestingSystem(files, ts)
    const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
    const { manifest } = await extractWithSystem(system, { dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetAnime')
    expect(manifest.operations).toHaveProperty('GetLevel')
  })

  it('extracts a query via inline object property access', async () => {
    const files: Record<string, string> = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { createGazania } from 'gazania'
const schemas = { g: createGazania('https://example.com/graphql') }
const doc = schemas.g.query('InlineObj').select($ => $.select(['id']))`,
    }
    const system = createTestingSystem(files, ts)
    const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
    const { manifest } = await extractWithSystem(system, { dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('InlineObj')
  })
})

describe('type-aware extract: name shadowing (local var shadows global)', () => {
  const baseDir = '/vfs/ta-scenarios-shadow'

  it('does not extract a query from a local variable that shadows a global gazania builder', async () => {
    const files: Record<string, string> = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/auto-imports.d.ts`]: [
        `import type { gazania } from 'gazania'`,
        `declare global {`,
        `  const schema: typeof gazania`,
        `}`,
        `export {}`,
      ].join('\n'),
      [`${baseDir}/src/query.ts`]: `const schema = { select: (cb: any) => ({ type: 'custom', ...cb() }) }
const result = schema.select(() => ['field'])`,
    }
    const system = createTestingSystem(files, ts)
    const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
    const { manifest, skipped } = await extractWithSystem(system, { dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed })
    expect(Object.keys(manifest.operations)).toHaveLength(0)
    expect(Object.keys(manifest.fragments)).toHaveLength(0)
    expect(skipped).toHaveLength(0)
  })

  it('still extracts gazania queries when global is not shadowed', async () => {
    const files: Record<string, string> = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/auto-imports.d.ts`]: [
        `import type { gazania } from 'gazania'`,
        `declare global {`,
        `  const schema: typeof gazania`,
        `}`,
        `export {}`,
      ].join('\n'),
      [`${baseDir}/src/query.ts`]: `const doc = schema.query('GlobalQuery').select($ => $.select(['id']))`,
    }
    const system = createTestingSystem(files, ts)
    const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
    const { manifest, skipped } = await extractWithSystem(system, { dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GlobalQuery')
    expect(Object.keys(manifest.operations)).toHaveLength(1)
    expect(skipped).toHaveLength(0)
  })

  it('extracts gazania query and ignores shadowed variable in a nested scope', async () => {
    const files: Record<string, string> = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/auto-imports.d.ts`]: [
        `import type { gazania } from 'gazania'`,
        `declare global {`,
        `  const schema: typeof gazania`,
        `}`,
        `export {}`,
      ].join('\n'),
      [`${baseDir}/src/query.ts`]: `const doc1 = schema.query('RealQuery').select($ => $.select(['id']))
{
  const schema = { select: (cb: any) => ({ type: 'custom' }) }
  const result = schema.select(() => ['field'])
}`,
    }
    const system = createTestingSystem(files, ts)
    const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
    const { manifest, skipped } = await extractWithSystem(system, {
      dir: `${baseDir}/src`,
      hash: sha256,
      tsconfig: parsed,
      ignoreCategories: ['analysis', 'unresolved'],
    })
    expect(manifest.operations).toHaveProperty('RealQuery')
    expect(Object.keys(manifest.operations)).toHaveLength(1)
    expect(skipped).toHaveLength(0)
  })
})
