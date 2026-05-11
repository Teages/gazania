import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extract } from '../../src/extract'
import { ExtractionError } from '../../src/extract/manifest'
import { loadTS, parseTSConfig } from '../../src/extract/ts-program'

const sha256 = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`

function setupDescribe(getDir: () => string) {
  async function getParsed() {
    const ts = await loadTS()
    return parseTSConfig(ts, join(getDir(), 'tsconfig.json'), ts.sys)
  }
  return { getParsed }
}

describe('extract', () => {
  let dir: string
  const { getParsed } = setupDescribe(() => dir)

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-extract-test-${randomUUID()}`)
    await mkdir(dir, { recursive: true })
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
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns an empty manifest when no gazania files found', async () => {
    await writeFile(join(dir, 'src', 'index.js'), `const x = 1`)
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toEqual({})
    expect(manifest.fragments).toEqual({})
  })

  it('extracts a simple query from a JS file', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('TestQuery').select($ => $.select(['id', 'name']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('TestQuery')
    expect(manifest.operations.TestQuery.body).toContain('query TestQuery')
    expect(manifest.operations.TestQuery.hash).toMatch(/^sha256:/)
  })

  it('extracts a mutation', async () => {
    await writeFile(
      join(dir, 'src', 'mutation.js'),
      `import { gazania } from 'gazania'
const doc = gazania.mutation('CreateUser')
  .vars({ input: 'CreateUserInput!' })
  .select(($, vars) => $.select([{ createUser: $ => $.args({ input: vars.input }).select(['id']) }]))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('CreateUser')
    expect(manifest.operations.CreateUser.body).toContain('mutation CreateUser')
  })

  it('extracts a fragment', async () => {
    await writeFile(
      join(dir, 'src', 'fragment.js'),
      `import { gazania } from 'gazania'
const doc = gazania.fragment('UserFields').on('User').select($ => $.select(['id', 'name']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.fragments).toHaveProperty('UserFields')
    expect(manifest.fragments.UserFields.body).toContain('fragment UserFields on User')
  })

  it('extracts multiple queries from multiple files', async () => {
    await writeFile(join(dir, 'src', 'a.js'), `import { gazania } from 'gazania'\nconst doc = gazania.query('QueryA').select($ => $.select(['fieldA']))`)
    await writeFile(join(dir, 'src', 'b.js'), `import { gazania } from 'gazania'\nconst doc = gazania.query('QueryB').select($ => $.select(['fieldB']))`)
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('QueryA')
    expect(manifest.operations).toHaveProperty('QueryB')
  })

  it('handles files that cannot be parsed', async () => {
    await writeFile(join(dir, 'src', 'broken.js'), `this is not valid javascript {{{`)
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toEqual({})
  })

  it('supports different hash algorithms', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('TestQuery').select($ => $.select(['id']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: (body: string) => `md5:${createHash('md5').update(body).digest('hex')}`, tsconfig: parsed })
    expect(manifest.operations.TestQuery.hash).toMatch(/^md5:/)
  })

  it('propagates errors from the hash function', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('TestQuery').select($ => $.select(['id']))`,
    )
    const brokenHash = () => {
      throw new Error('hash failed')
    }
    const parsed = await getParsed()
    await expect(extract({ dir: join(dir, 'src'), hash: brokenHash, tsconfig: parsed }))
      .rejects
      .toThrow('hash failed')
  })

  it('extracts a query from a .vue <script setup> block', async () => {
    await writeFile(
      join(dir, 'src', 'Comp.vue'),
      `<template><div/></template>
<script setup>
import { gazania } from 'gazania'
const VueQuery = gazania.query('VueQuery').select($ => $.select(['id']))
</script>`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), include: '**/*.{vue}', hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('VueQuery')
  })

  it('extracts queries from both <script> and <script setup> in a .vue file', async () => {
    await writeFile(
      join(dir, 'src', 'Comp.vue'),
      `<template><div/></template>
<script>
import { gazania } from 'gazania'
const VueFrag = gazania.fragment('VueFrag').on('User').select($ => $.select(['id']))
</script>
<script setup>
import { gazania } from 'gazania'
const VueSetupQuery = gazania.query('VueSetupQuery').select($ => $.select(['name']))
</script>`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), include: '**/*.{vue}', hash: sha256, tsconfig: parsed })
    expect(manifest.fragments).toHaveProperty('VueFrag')
    expect(manifest.operations).toHaveProperty('VueSetupQuery')
  })

  it('extracts a query from a .svelte <script> block', async () => {
    await writeFile(
      join(dir, 'src', 'Comp.svelte'),
      `<script>
import { gazania } from 'gazania'
const SvelteQuery = gazania.query('SvelteQuery').select($ => $.select(['id']))
</script>
<main />`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), include: '**/*.{svelte}', hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('SvelteQuery')
  })

  it('extracts a query from a .ts file with type annotations', async () => {
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { createGazania } from 'gazania'
const API: string = 'https://api.example.com/graphql'
const gazania = createGazania(API)
const TypedQuery = gazania.query('TypedQuery').select($ => $.select(['id']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('TypedQuery')
  })

  it('extracts a query from a .tsx file with JSX and TypeScript types', async () => {
    await writeFile(
      join(dir, 'src', 'App.tsx'),
      `import { createGazania } from 'gazania'
const API = 'https://api.example.com/graphql'
const gazania = createGazania(API)
const TsxQuery = gazania.query('TsxQuery').select($ => $.select(['id']))
interface User { id: string }
function App() { return <div /> }`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('TsxQuery')
  })

  it('extracts a query that uses a same-file partial', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
    expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
  })

  it('extracts a query that uses a same-file section', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const userSection = gazania.section('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userSection({}),
    ]),
  }]))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
  })

  it('extracts a query using multiple same-file partials', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const namePartial = gazania.partial('UserName')
  .on('User')
  .select($ => $.select(['name']))
const emailPartial = gazania.partial('UserEmail')
  .on('User')
  .select($ => $.select(['email']))
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...namePartial({}),
      ...emailPartial({}),
    ]),
  }]))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserName')
    expect(manifest.operations.GetUser.body).toContain('...UserEmail')
  })
})

describe('extract with tsconfig (cross-file)', () => {
  let dir: string
  const { getParsed } = setupDescribe(() => dir)

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-crossfile-test-${randomUUID()}`)
    await mkdir(dir, { recursive: true })
    await mkdir(join(dir, 'src'), { recursive: true })
    await mkdir(join(dir, 'src', 'fragments'), { recursive: true })

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
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('extracts a query that uses a cross-file partial', async () => {
    await writeFile(
      join(dir, 'src', 'fragments', 'user.js'),
      `import { gazania } from 'gazania'
export const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
    )
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
import { userPartial } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
    )

    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
    expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
  })

  it('extracts a query that uses a cross-file section', async () => {
    await writeFile(
      join(dir, 'src', 'fragments', 'user.js'),
      `import { gazania } from 'gazania'
export const userSection = gazania.section('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
    )
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
import { userSection } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userSection({}),
    ]),
  }]))`,
    )

    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
  })

  it('extracts with multiple cross-file partials from different files', async () => {
    await writeFile(
      join(dir, 'src', 'fragments', 'name.js'),
      `import { gazania } from 'gazania'
export const namePartial = gazania.partial('UserName')
  .on('User')
  .select($ => $.select(['name']))`,
    )
    await writeFile(
      join(dir, 'src', 'fragments', 'email.js'),
      `import { gazania } from 'gazania'
export const emailPartial = gazania.partial('UserEmail')
  .on('User')
  .select($ => $.select(['email']))`,
    )
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
import { namePartial } from './fragments/name'
import { emailPartial } from './fragments/email'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...namePartial({}),
      ...emailPartial({}),
    ]),
  }]))`,
    )

    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserName')
    expect(manifest.operations.GetUser.body).toContain('...UserEmail')
  })

  it('handles re-exported partials with alias', async () => {
    await writeFile(
      join(dir, 'src', 'fragments', 'user.js'),
      `import { gazania } from 'gazania'
const _userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
export { _userPartial as userPartial }`,
    )
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
import { userPartial } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
    )

    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
  })

  it('still extracts simple queries without cross-file dependencies', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('SimpleQuery').select($ => $.select(['id']))`,
    )

    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('SimpleQuery')
  })

  it('extracts operations that use cross-file partials when a circular dependency exists', async () => {
    await writeFile(
      join(dir, 'src', 'index.ts'),
      `import { createGazania } from 'gazania'
import { userPartial } from './fragments'
export const gazania = createGazania('https://example.com/graphql')
export const GetUsersWithFragment = gazania.query('GetUsersWithFragment')
  .select($ => $.select([{
    users: $ => $.select([...userPartial({})]),
  }]))`,
    )
    await writeFile(
      join(dir, 'src', 'fragments.ts'),
      `import { gazania } from './index'
export const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
    )

    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetUsersWithFragment')
    expect(manifest.operations.GetUsersWithFragment!.body).toContain('...UserFields')
    expect(manifest.operations.GetUsersWithFragment!.body).toContain('fragment UserFields on User')
  })

  it('extracts operations from framework files (Vue/Svelte/React) that import gazania from a local module', async () => {
    await writeFile(
      join(dir, 'src', 'index.ts'),
      `import { createGazania } from 'gazania'
export const gazania = createGazania('https://example.com/graphql')`,
    )
    await writeFile(
      join(dir, 'src', 'App.vue'),
      `<script setup lang="ts">
import { gazania } from './index'
const VueQuery = gazania.query('GetUsers_Vue').select($ => $.select(['id', 'name']))
</script>
<template><div /></template>`,
    )
    await writeFile(
      join(dir, 'src', 'App.svelte'),
      `<script lang="ts">
import { gazania } from './index'
const SvelteQuery = gazania.query('GetUsers_Svelte').select($ => $.select(['id', 'name']))
</script>
<main />`,
    )
    await writeFile(
      join(dir, 'src', 'react.tsx'),
      `import { gazania } from './index'
const ReactQuery = gazania.query('GetUsers_React').select($ => $.select(['id', 'name']))`,
    )

    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('GetUsers_Vue')
    expect(manifest.operations).toHaveProperty('GetUsers_Svelte')
    expect(manifest.operations).toHaveProperty('GetUsers_React')
  })
})

describe('extract: skipped calls', () => {
  let dir: string
  const { getParsed } = setupDescribe(() => dir)

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-skipped-test-${randomUUID()}`)
    await mkdir(dir, { recursive: true })
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
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns empty skipped array when all calls succeed', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('OkQuery').select($ => $.select(['id']))`,
    )
    const parsed = await getParsed()
    const { skipped } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(skipped).toHaveLength(0)
  })

  it('throws ExtractionError when a call references an undefined variable', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
    )
    const parsed = await getParsed()
    try {
      await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect(err).toBeInstanceOf(ExtractionError)
      const skipped = (err as ExtractionError).skipped
      expect(skipped).toHaveLength(1)
      expect(skipped[0]!.reason).toMatch(/missingPartial is not defined/)
      expect(skipped[0]!.category).toBe('unresolved')
    }
  })

  it('extractionError.skipped entry includes the absolute file path', async () => {
    const { join: pathJoin } = await import('node:path')
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('X').select($ => $.select([...gone({})]))`,
    )
    const parsed = await getParsed()
    try {
      await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect(err).toBeInstanceOf(ExtractionError)
      expect((err as ExtractionError).skipped[0]!.file).toBe(pathJoin(dir, 'src', 'query.js'))
    }
  })

  it('extractionError.skipped entry has a 1-based line number pointing to the failing call', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\n\nconst doc = gazania.query('LineTest').select($ => $.select([...gone({})]))`,
    )
    const parsed = await getParsed()
    try {
      await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect(err).toBeInstanceOf(ExtractionError)
      expect((err as ExtractionError).skipped[0]!.line).toBe(3)
    }
  })

  it('extractionError.skipped entry line number accounts for SFC lineOffset in Vue files', async () => {
    const vue = `<template><div/></template>\n<script setup>\nimport { gazania } from 'gazania'\nconst doc = gazania.query('VueFail').select($ => $.select([...gone({})]))\n</script>`
    await writeFile(join(dir, 'src', 'Comp.vue'), vue)
    const parsed = await getParsed()
    try {
      await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect(err).toBeInstanceOf(ExtractionError)
      expect((err as ExtractionError).skipped[0]!.line).toBe(4)
    }
  })

  it('collects skipped calls from multiple files in ExtractionError', async () => {
    await writeFile(
      join(dir, 'src', 'a.js'),
      `import { gazania } from 'gazania'\nconst d = gazania.query('A').select($ => $.select([...x({})]))`,
    )
    await writeFile(
      join(dir, 'src', 'b.js'),
      `import { gazania } from 'gazania'\nconst d = gazania.query('B').select($ => $.select([...y({})]))`,
    )
    const parsed = await getParsed()
    try {
      await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect(err).toBeInstanceOf(ExtractionError)
      const skipped = (err as ExtractionError).skipped
      expect(skipped).toHaveLength(2)
      const files = skipped.map(s => s.file)
      expect(files.some(f => f.endsWith('a.js'))).toBe(true)
      expect(files.some(f => f.endsWith('b.js'))).toBe(true)
    }
  })

  it('ignoreCategories suppresses ExtractionError for matching categories', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
    )
    const parsed = await getParsed()
    const { manifest, skipped } = await extract({
      dir: join(dir, 'src'),
      hash: sha256,
      tsconfig: parsed,
      ignoreCategories: ['unresolved'],
    })
    expect(manifest.operations).not.toHaveProperty('FailQuery')
    expect(skipped).toHaveLength(1)
    expect(skipped[0]!.category).toBe('unresolved')
  })

  it('ignoreCategories with all categories suppresses all errors', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
    )
    const parsed = await getParsed()
    const { skipped } = await extract({
      dir: join(dir, 'src'),
      hash: sha256,
      tsconfig: parsed,
      ignoreCategories: ['unresolved', 'analysis', 'circular'],
    })
    expect(skipped).toHaveLength(1)
  })

  it('ignoreCategories does not suppress non-matching categories', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
    )
    const parsed = await getParsed()
    await expect(extract({
      dir: join(dir, 'src'),
      hash: sha256,
      tsconfig: parsed,
      ignoreCategories: ['analysis'],
    })).rejects.toThrow(ExtractionError)
  })

  it('cross-file mode: skipped when imported file is outside the scanned directory', async () => {
    await mkdir(join(dir, 'fragments'), { recursive: true })
    await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'esnext',
        moduleResolution: 'bundler',
        baseUrl: resolve(process.cwd()),
        paths: {
          gazania: ['src/index.ts'],
        },
      },
      include: ['src', 'fragments'],
    }))
    await writeFile(
      join(dir, 'fragments', 'user.ts'),
      `import { gazania } from 'gazania'\nexport const myPartial = gazania.partial('User').on('User').select($ => $.select(['id']))`,
    )
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { myPartial } from '../fragments/user'\nimport { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select([...myPartial({})]))`,
    )
    const parsed = await getParsed()
    const { manifest, skipped } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed, ignoreCategories: ['unresolved'] })
    expect(manifest.operations).not.toHaveProperty('GetUser')
    expect(skipped).toHaveLength(1)
    expect(skipped[0]!.reason).toMatch(/myPartial is not defined/)
    expect(skipped[0]!.category).toBe('unresolved')
  })
})

describe('extract: integration', () => {
  let dir: string
  const { getParsed } = setupDescribe(() => dir)

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-integration-test-${randomUUID()}`)
    await mkdir(dir, { recursive: true })
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
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('manifest entries contain loc field', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('LocQuery').select($ => $.select(['id', 'name']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    const entry = manifest.operations.LocQuery
    expect(entry).toBeDefined()
    expect(entry!.loc).toBeDefined()
    expect(entry!.loc.start.line).toBeGreaterThanOrEqual(1)
    expect(entry!.loc.start.column).toBeGreaterThanOrEqual(1)
    expect(entry!.loc.end.line).toBeGreaterThanOrEqual(entry!.loc.start.line)
    expect(entry!.loc.start.offset).toBeGreaterThanOrEqual(0)
    expect(entry!.loc.end.offset).toBeGreaterThanOrEqual(entry!.loc.start.offset)
  })

  it('throws for duplicate operation names with different bodies across files', async () => {
    await writeFile(
      join(dir, 'src', 'a.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('DupQuery').select($ => $.select(['id']))`,
    )
    await writeFile(
      join(dir, 'src', 'b.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('DupQuery').select($ => $.select(['name']))`,
    )
    const parsed = await getParsed()
    await expect(extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed }))
      .rejects
      .toThrow(/Duplicate operation name "DupQuery"/)
  })

  it('silently skips duplicate operations with identical bodies across files', async () => {
    const queryCode = `import { gazania } from 'gazania'\nconst doc = gazania.query('SameQuery').select($ => $.select(['id']))`
    await writeFile(join(dir, 'src', 'a.js'), queryCode)
    await writeFile(join(dir, 'src', 'b.js'), queryCode)
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(Object.keys(manifest.operations)).toHaveLength(1)
    expect(manifest.operations).toHaveProperty('SameQuery')
  })

  it('loc field points to the correct source line', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `// comment line 1
// comment line 2
import { gazania } from 'gazania'
const doc = gazania.query('LineQuery').select($ => $.select(['id']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    const entry = manifest.operations.LineQuery
    expect(entry).toBeDefined()
    expect(entry!.loc.start.line).toBeGreaterThanOrEqual(3)
  })

  it('loc has exact line/column for a .ts file (SourceFile reuse path)', async () => {
    // Line 1: import
    // Line 2: const query = gazania.query('ExactLoc').select(...)
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { gazania } from 'gazania'
const doc = gazania.query('ExactLoc').select($ => $.select(['id']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    const entry = manifest.operations.ExactLoc
    expect(entry).toBeDefined()
    expect(entry!.loc.start.line).toBe(2)
    expect(entry!.loc.start.column).toBeGreaterThanOrEqual(1)
    expect(entry!.loc.end.line).toBe(2)
    expect(entry!.loc.end.offset).toBeGreaterThan(entry!.loc.start.offset)
    expect(entry!.loc.file).toContain('query.ts')
  })

  it('loc has exact line/column for a .vue SFC file (with lineOffset)', async () => {
    // Line 1: <template><div/></template>
    // Line 2: <script>
    // Line 3:   (leading \n stripped → folded into lineOffset=2)
    // Line 3 (effective): import { gazania } from 'gazania'
    // Line 4 (effective): const doc = gazania.query('VueLoc').select(...)
    await writeFile(
      join(dir, 'src', 'Comp.vue'),
      `<template><div/></template>
<script>
import { gazania } from 'gazania'
const doc = gazania.query('VueLoc').select($ => $.select(['id']))
</script>`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), include: '**/*.{vue}', hash: sha256, tsconfig: parsed })
    const entry = manifest.operations.VueLoc
    expect(entry).toBeDefined()
    expect(entry!.loc.start.line).toBe(4)
    expect(entry!.loc.start.column).toBeGreaterThanOrEqual(1)
    expect(entry!.loc.end.line).toBe(4)
    expect(entry!.loc.file).toContain('Comp.vue')
  })

  it('loc has exact line/column for a .svelte file (with lineOffset)', async () => {
    // Line 1: <script>
    // Line 2: import { gazania } from 'gazania'
    // Line 3: const doc = gazania.query('SvelteLoc').select(...)
    // Line 4: </script>
    await writeFile(
      join(dir, 'src', 'App.svelte'),
      `<script>
import { gazania } from 'gazania'
const doc = gazania.query('SvelteLoc').select($ => $.select(['id']))
</script>
<main />`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), include: '**/*.{svelte}', hash: sha256, tsconfig: parsed })
    const entry = manifest.operations.SvelteLoc
    expect(entry).toBeDefined()
    expect(entry!.loc.start.line).toBe(3)
    expect(entry!.loc.start.column).toBeGreaterThanOrEqual(1)
    expect(entry!.loc.end.line).toBe(3)
    expect(entry!.loc.file).toContain('App.svelte')
  })

  it('loc end is after start for a multi-line chained call', async () => {
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { gazania } from 'gazania'
const doc = gazania
  .query('MultiLine')
  .select($ => $.select(['id']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    const entry = manifest.operations.MultiLine
    expect(entry).toBeDefined()
    expect(entry!.loc.start.line).toBe(2)
    expect(entry!.loc.end.line).toBe(4)
    expect(entry!.loc.end.offset).toBeGreaterThan(entry!.loc.start.offset)
  })
})

describe('typescript-estree parsing', () => {
  it('parses plain JavaScript', async () => {
    const { parse } = await import('@typescript-eslint/typescript-estree')
    const ast = parse(`const x = 1`, { range: true })
    expect(ast.type).toBe('Program')
  })

  it('parses JSX', async () => {
    const { parse } = await import('@typescript-eslint/typescript-estree')
    const ast = parse(`const App = () => <div>hello</div>`, { range: true, jsx: true })
    expect(ast.type).toBe('Program')
  })

  it('parses TypeScript directly', async () => {
    const { parse } = await import('@typescript-eslint/typescript-estree')
    const ast = parse(`const x: string = 'hello'`, { range: true, filePath: 'test.ts' })
    expect(ast.type).toBe('Program')
  })

  it('parses TypeScript + JSX', async () => {
    const { parse } = await import('@typescript-eslint/typescript-estree')
    const ast = parse(`const x: string = 'hello'; const App = () => <div />`, { range: true, filePath: 'test.tsx' })
    expect(ast.type).toBe('Program')
  })
})

describe('extract: auto-import (declare global)', () => {
  let dir: string
  const { getParsed } = setupDescribe(() => dir)

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-auto-import-test-${randomUUID()}`)
    await mkdir(dir, { recursive: true })
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

    // Simulates the `.d.ts` shim generated by framework auto-import tools (e.g. Nuxt).
    // The `schema` global gets the same type as `gazania`, so the extractor can
    // identify it via the `~isGazania` marker even without an explicit import.
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

  it('extracts a query from a .ts file using an auto-imported builder', async () => {
    await writeFile(
      join(dir, 'src', 'query.ts'),
      // `schema` is not imported — it is declared globally in auto-imports.d.ts
      `const doc = schema.query('AutoImportTs').select($ => $.select(['id']))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('AutoImportTs')
    expect(manifest.operations.AutoImportTs!.body).toContain('query AutoImportTs')
  })

  it('extracts a query from a .vue file using an auto-imported builder', async () => {
    await writeFile(
      join(dir, 'src', 'Comp.vue'),
      `<template><div /></template>\n<script setup lang="ts">\nconst doc = schema.query('AutoImportVue').select($ => $.select(['id']))\n</script>`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('AutoImportVue')
    expect(manifest.operations.AutoImportVue!.body).toContain('query AutoImportVue')
  })

  it.todo('extracts a query from a .svelte file using an auto-imported builder')

  it.todo('extracts queries from .ts, .vue, and .svelte files simultaneously')

  it('ignores files that have no queries even with the global builder in scope', async () => {
    await writeFile(
      join(dir, 'src', 'no-queries.ts'),
      `// schema is available but no queries are defined here\nconst x = 1`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(Object.keys(manifest.operations)).toHaveLength(0)
  })

  it('expands an auto-imported partial in a query that uses it', async () => {
    // partial.ts defines a partial using the globally auto-imported `schema`
    await writeFile(
      join(dir, 'src', 'partial.ts'),
      `export const userPartial = schema.partial('UserFields').on('User').select($ => $.select(['id', 'name']))`,
    )
    // query.ts imports that partial and uses it inside a query, also via the auto-imported `schema`
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { userPartial } from './partial'
const doc = schema.query('AutoImportPartial').select($ => $.select([{
  user: $ => $.select([...userPartial({})]),
}]))`,
    )
    const parsed = await getParsed()
    const { manifest } = await extract({ dir: join(dir, 'src'), hash: sha256, tsconfig: parsed })
    expect(manifest.operations).toHaveProperty('AutoImportPartial')
    expect(manifest.operations.AutoImportPartial!.body).toContain('...UserFields')
    expect(manifest.operations.AutoImportPartial!.body).toContain('fragment UserFields on User')
  })
})
