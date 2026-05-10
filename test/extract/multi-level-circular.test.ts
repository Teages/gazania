/**
 * Circular partial reference detection test.
 *
 * File dependency graph:
 *
 *   5_query → 4_b → 3_c ──→ 2_e ──┐
 *                    ↑        ↓     │
 *                    └──────────────┘  (circular: 3_c imports partialE, 2_e imports partialC)
 *                    3_c also → 1_d (leaf)
 *
 *   - partialC (3_c) uses partialD (1_d) AND partialE (2_e)
 *   - partialE (2_e) uses partialC (3_c) — circular partial reference
 *   - Consumer (5_query) only imports partialB
 *
 * Circular fragment spreads are forbidden by GraphQL spec Section 5.5.2.2.
 * The extractor must reject this pattern and report it via the `skipped` array
 * rather than silently producing an incomplete document.
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extract } from '../../src/extract'
import { loadTS, parseTSConfig } from '../../src/extract/ts-program'

const sha256 = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`

describe('circular partial reference detection', () => {
  let dir: string

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-circular-partial-${randomUUID()}`)
    await mkdir(join(dir, 'src'), { recursive: true })

    await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'esnext',
        module: 'esnext',
        moduleResolution: 'bundler',
        baseUrl: resolve(process.cwd()),
        paths: {
          gazania: ['src/index.ts'],
        },
      },
      include: ['src'],
    }))

    await writeFile(join(dir, 'src', '0_index.ts'), `
import { createGazania } from 'gazania'
export const gazania = createGazania('https://example.com/graphql')
`)

    await writeFile(join(dir, 'src', '1_d.ts'), `
import { gazania } from './0_index'
export const partialD = gazania.partial('PartialD').on('User').select($ => $.select(['id']))
`)

    await writeFile(join(dir, 'src', '2_e.ts'), `
import { gazania } from './0_index'
import { partialC } from './3_c'
export const partialE = gazania.partial('PartialE').on('User').select($ => $.select([...partialC({}), 'name']))
`)

    await writeFile(join(dir, 'src', '3_c.ts'), `
import { gazania } from './0_index'
import { partialD } from './1_d'
import { partialE } from './2_e'
export const partialC = gazania.partial('PartialC').on('User')
  .select($ => $.select([...partialD({}), ...partialE({})]))
`)

    await writeFile(join(dir, 'src', '4_b.ts'), `
import { gazania } from './0_index'
import { partialC } from './3_c'
export const partialB = gazania.partial('PartialB').on('User')
  .select($ => $.select([...partialC({})]))
`)

    await writeFile(join(dir, 'src', '5_query.ts'), `
import { gazania } from './0_index'
import { partialB } from './4_b'
export const GetUsers = gazania.query('GetUsers')
  .select($ => $.select([...partialB({})]))
`)
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects circular partial references and reports them as skipped', async () => {
    const ts = await loadTS()
    const parsed = parseTSConfig(ts, join(dir, 'tsconfig.json'), ts.sys)
    const { manifest, skipped } = await extract({
      dir: join(dir, 'src'),
      hash: sha256,
      tsconfig: parsed,
      ignoreCategories: ['circular'],
    })

    expect(skipped.length).toBe(1)
    expect(skipped[0].reason).toContain('Circular fragment reference detected')

    const circularSkip = skipped.find(s =>
      s.reason.includes('Circular fragment reference detected'),
    )
    expect(circularSkip).toBeDefined()
    expect(circularSkip!.reason).toContain('PartialC')
    expect(circularSkip!.reason).toContain('PartialE')
    expect(circularSkip!.reason).toContain('GraphQL spec 5.5.2.2')

    if (manifest.operations.GetUsers) {
      const body = manifest.operations.GetUsers!.body
      expect(body).toMatchInlineSnapshot(`
        "query GetUsers {
          ...PartialB
        }

        fragment PartialD on User {
          id
        }

        fragment PartialC on User {
          ...PartialD
        }

        fragment PartialB on User {
          ...PartialC
        }"
      `)
    }
  })
})
