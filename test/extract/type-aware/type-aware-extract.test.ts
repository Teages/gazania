/**
 * Integration tests for TypeChecker-based builder name detection.
 *
 * These tests exercise the `extract()` API end-to-end with patterns that
 * require the TypeScript TypeChecker to resolve builder names:
 *
 *   1. Re-export / barrel file
 *   2. Aliased factory (createGazania)
 *   3. Namespace import (import * as)
 *   4. Mixed patterns
 *   5. Error path (missing tsconfig)
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extract } from '../../../src/extract'

async function createTempProject(): Promise<string> {
  const dir = join(tmpdir(), `gazania-type-aware-${Date.now()}`)
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

  return dir
}

// ─── Re-export / barrel file ────────────────────────────────────────────────

describe('type-aware extract: re-export / barrel file', () => {
  let dir: string

  beforeEach(async () => {
    dir = await createTempProject()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('extracts a query when gazania is re-exported through a barrel file', async () => {
    await writeFile(
      join(dir, 'src', 'barrel.ts'),
      `export { gazania } from 'gazania'`,
    )

    await writeFile(
      join(dir, 'src', 'consumer.ts'),
      `import { gazania } from './barrel'
const doc = gazania.query('BarrelQuery').select($ => $.select(['id', 'name']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('BarrelQuery')
    expect(manifest.operations.BarrelQuery.body).toContain('query BarrelQuery')
    expect(manifest.operations.BarrelQuery.body).toContain('id')
    expect(manifest.operations.BarrelQuery.body).toContain('name')
  })

  it('extracts a query from a two-level re-export chain', async () => {
    await writeFile(
      join(dir, 'src', 'api.ts'),
      `export { gazania } from 'gazania'`,
    )
    await writeFile(
      join(dir, 'src', 'index.ts'),
      `export { gazania } from './api'`,
    )
    await writeFile(
      join(dir, 'src', 'consumer.ts'),
      `import { gazania } from './index'
const doc = gazania.query('DeepBarrelQuery').select($ => $.select(['status']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('DeepBarrelQuery')
    expect(manifest.operations.DeepBarrelQuery.body).toContain('query DeepBarrelQuery')
    expect(manifest.operations.DeepBarrelQuery.body).toContain('status')
  })

  it('extracts a query when barrel also exports createGazania', async () => {
    await writeFile(
      join(dir, 'src', 'barrel.ts'),
      `export { gazania, createGazania } from 'gazania'`,
    )

    await writeFile(
      join(dir, 'src', 'consumer.ts'),
      `import { gazania } from './barrel'
const doc = gazania.query('BarrelExportQuery').select($ => $.select(['id']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('BarrelExportQuery')
  })
})

// ─── Aliased factory (createGazania) ────────────────────────────────────────

describe('type-aware extract: aliased factory', () => {
  let dir: string

  beforeEach(async () => {
    dir = await createTempProject()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('extracts a query when builder is created via createGazania() in the same file', async () => {
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { createGazania } from 'gazania'
const g = createGazania('https://api.example.com/graphql')
const doc = g.query('FactoryQuery').select($ => $.select(['id', 'name']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('FactoryQuery')
    expect(manifest.operations.FactoryQuery.body).toContain('query FactoryQuery')
    expect(manifest.operations.FactoryQuery.body).toContain('id')
    expect(manifest.operations.FactoryQuery.body).toContain('name')
  })

  it('extracts a mutation created via createGazania() in the same file', async () => {
    await writeFile(
      join(dir, 'src', 'mutation.ts'),
      `import { createGazania } from 'gazania'
const g = createGazania('https://api.example.com/graphql')
const doc = g.mutation('FactoryMutation')
  .vars({ input: 'String!' })
  .select(($, vars) => $.select([{ createUser: $ => $.args({ input: vars.input }).select(['id']) }]))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('FactoryMutation')
    expect(manifest.operations.FactoryMutation.body).toContain('mutation FactoryMutation')
  })

  it('extracts a fragment created via createGazania() in the same file', async () => {
    await writeFile(
      join(dir, 'src', 'frag.ts'),
      `import { createGazania } from 'gazania'
const g = createGazania('https://api.example.com/graphql')
const doc = g.fragment('FactoryFragment').on('User').select($ => $.select(['id', 'email']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.fragments).toHaveProperty('FactoryFragment')
    expect(manifest.fragments.FactoryFragment.body).toContain('fragment FactoryFragment on User')
  })

  it('extracts a query when factory builder is imported from a local module that exports gazania', async () => {
    await writeFile(
      join(dir, 'src', 'api.ts'),
      `import { createGazania } from 'gazania'
export const gazania = createGazania('https://api.example.com/graphql')`,
    )

    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { gazania } from './api'
const doc = gazania.query('CrossFileFactoryQuery').select($ => $.select(['id']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('CrossFileFactoryQuery')
    expect(manifest.operations.CrossFileFactoryQuery.body).toContain('query CrossFileFactoryQuery')
  })

  it('extracts a query that uses cross-file partials with factory builder', async () => {
    await writeFile(
      join(dir, 'src', 'api.ts'),
      `import { createGazania } from 'gazania'
export const gazania = createGazania('https://api.example.com/graphql')`,
    )

    await writeFile(
      join(dir, 'src', 'partials.ts'),
      `import { gazania } from './api'
export const userFields = gazania.partial('FactoryUserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
    )

    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { gazania } from './api'
import { userFields } from './partials'
const doc = gazania.query('FactoryWithPartial')
  .select($ => $.select([{
    user: $ => $.select([...userFields({})]),
  }]))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('FactoryWithPartial')
    expect(manifest.operations.FactoryWithPartial.body).toContain('...FactoryUserFields')
    expect(manifest.operations.FactoryWithPartial.body).toContain('fragment FactoryUserFields on User')
  })
})

// ─── Namespace import ────────────────────────────────────────────────────────

describe('type-aware extract: namespace import', () => {
  let dir: string

  beforeEach(async () => {
    dir = await createTempProject()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('extracts a query via namespace import (import * as)', async () => {
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import * as G from 'gazania'
const doc = G.gazania.query('NsQuery').select($ => $.select(['id']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('NsQuery')
    expect(manifest.operations.NsQuery.body).toContain('query NsQuery')
    expect(manifest.operations.NsQuery.body).toContain('id')
  })

  it('extracts a mutation via namespace import', async () => {
    await writeFile(
      join(dir, 'src', 'mutation.ts'),
      `import * as G from 'gazania'
const doc = G.gazania.mutation('NsMutation')
  .vars({ id: 'ID!' })
  .select(($, vars) => $.select([{ deleteUser: $ => $.args({ id: vars.id }).select(['success']) }]))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('NsMutation')
    expect(manifest.operations.NsMutation.body).toContain('mutation NsMutation')
  })

  it('extracts a fragment via namespace import', async () => {
    await writeFile(
      join(dir, 'src', 'frag.ts'),
      `import * as G from 'gazania'
const doc = G.gazania.fragment('NsFragment').on('User').select($ => $.select(['name']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.fragments).toHaveProperty('NsFragment')
    expect(manifest.fragments.NsFragment.body).toContain('fragment NsFragment on User')
  })

  it('extracts a query that uses cross-file partial via namespace import', async () => {
    await writeFile(
      join(dir, 'src', 'partials.ts'),
      `import * as G from 'gazania'
export const userFields = G.gazania.partial('NsUserFields')
  .on('User')
  .select($ => $.select(['id', 'email']))`,
    )

    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import * as G from 'gazania'
import { userFields } from './partials'
const doc = G.gazania.query('NsPartialQuery')
  .select($ => $.select([{
    user: $ => $.select([...userFields({})]),
  }]))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('NsPartialQuery')
    expect(manifest.operations.NsPartialQuery.body).toContain('...NsUserFields')
    expect(manifest.operations.NsPartialQuery.body).toContain('fragment NsUserFields on User')
  })
})

// ─── Mixed patterns ──────────────────────────────────────────────────────────

describe('type-aware extract: mixed patterns in a single project', () => {
  let dir: string

  beforeEach(async () => {
    dir = await createTempProject()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('extracts operations from direct import, factory, and namespace in one project', async () => {
    await writeFile(
      join(dir, 'src', 'direct.ts'),
      `import { gazania } from 'gazania'
const DirectQuery = gazania.query('DirectQuery').select($ => $.select(['id']))`,
    )

    await writeFile(
      join(dir, 'src', 'factory.ts'),
      `import { createGazania } from 'gazania'
const g = createGazania('https://api.example.com/graphql')
const FactoryQuery = g.query('FactoryQuery').select($ => $.select(['name']))`,
    )

    await writeFile(
      join(dir, 'src', 'namespace.ts'),
      `import * as NS from 'gazania'
const NsQuery = NS.gazania.query('NsQuery').select($ => $.select(['email']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('DirectQuery')
    expect(manifest.operations).toHaveProperty('FactoryQuery')
    expect(manifest.operations).toHaveProperty('NsQuery')
  })

  it('extracts operations from factory module re-exported through a barrel', async () => {
    await writeFile(
      join(dir, 'src', 'api.ts'),
      `import { createGazania } from 'gazania'
export const gazania = createGazania('https://api.example.com/graphql')`,
    )

    await writeFile(
      join(dir, 'src', 'index.ts'),
      `export { gazania } from './api'`,
    )

    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { gazania } from './index'
const doc = gazania.query('BarrelFactoryQuery').select($ => $.select(['id', 'status']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('BarrelFactoryQuery')
    expect(manifest.operations.BarrelFactoryQuery.body).toContain('query BarrelFactoryQuery')
    expect(manifest.operations.BarrelFactoryQuery.body).toContain('status')
  })

  it('extracts operations from namespace and factory module in one project', async () => {
    await writeFile(
      join(dir, 'src', 'api.ts'),
      `import { createGazania } from 'gazania'
export const gazania = createGazania('https://api.example.com/graphql')`,
    )

    await writeFile(
      join(dir, 'src', 'consumer-factory.ts'),
      `import { gazania } from './api'
const doc = gazania.query('MixedFactory').select($ => $.select(['id']))`,
    )

    await writeFile(
      join(dir, 'src', 'consumer-ns.ts'),
      `import * as G from 'gazania'
const doc = G.gazania.query('MixedNs').select($ => $.select(['name']))`,
    )

    const { manifest } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('MixedFactory')
    expect(manifest.operations).toHaveProperty('MixedNs')
  })
})

// ─── Error path ──────────────────────────────────────────────────────────────

describe('type-aware extract: error handling', () => {
  it('throws an error when tsconfig is not provided', async () => {
    await expect(
      // @ts-expect-error — intentionally omitting tsconfig
      extract({ dir: 'src' }),
    ).rejects.toThrow(/tsconfig is required/)
  })

  it('throws an error when tsconfig is an empty string', async () => {
    await expect(
      extract({ dir: 'src', tsconfig: '' }),
    ).rejects.toThrow(/tsconfig is required/)
  })
})
