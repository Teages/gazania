import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extract } from '../../src/extract'
import { ExtractionError } from '../../src/extract/manifest'

const sha256 = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`

describe('extract', () => {
  let dir: string

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
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toEqual({})
    expect(manifest.fragments).toEqual({})
  })

  it('extracts a simple query from a JS file', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('TestQuery').select($ => $.select(['id', 'name']))`,
    )
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('CreateUser')
    expect(manifest.operations.CreateUser.body).toContain('mutation CreateUser')
  })

  it('extracts a fragment', async () => {
    await writeFile(
      join(dir, 'src', 'fragment.js'),
      `import { gazania } from 'gazania'
const doc = gazania.fragment('UserFields').on('User').select($ => $.select(['id', 'name']))`,
    )
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.fragments).toHaveProperty('UserFields')
    expect(manifest.fragments.UserFields.body).toContain('fragment UserFields on User')
  })

  it('extracts multiple queries from multiple files', async () => {
    await writeFile(join(dir, 'src', 'a.js'), `import { gazania } from 'gazania'\nconst doc = gazania.query('QueryA').select($ => $.select(['fieldA']))`)
    await writeFile(join(dir, 'src', 'b.js'), `import { gazania } from 'gazania'\nconst doc = gazania.query('QueryB').select($ => $.select(['fieldB']))`)
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('QueryA')
    expect(manifest.operations).toHaveProperty('QueryB')
  })

  it('handles files that cannot be parsed', async () => {
    await writeFile(join(dir, 'src', 'broken.js'), `this is not valid javascript {{{`)
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toEqual({})
  })

  it('supports different hash algorithms', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('TestQuery').select($ => $.select(['id']))`,
    )
    const { manifest } = await extract({ dir: 'src', hash: (body: string) => `md5:${createHash('md5').update(body).digest('hex')}`, cwd: dir, tsconfig: 'tsconfig.json' })
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
    await expect(extract({ dir: 'src', hash: brokenHash, cwd: dir, tsconfig: 'tsconfig.json' }))
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
    const { manifest } = await extract({ dir: 'src', include: '**/*.{vue}', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    const { manifest } = await extract({ dir: 'src', include: '**/*.{vue}', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    const { manifest } = await extract({ dir: 'src', include: '**/*.{svelte}', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserName')
    expect(manifest.operations.GetUser.body).toContain('...UserEmail')
  })
})

describe('extract with tsconfig (cross-file)', () => {
  let dir: string

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-crossfile-test-${randomUUID()}`)
    await mkdir(dir, { recursive: true })
    await mkdir(join(dir, 'src'), { recursive: true })
    await mkdir(join(dir, 'src', 'fragments'), { recursive: true })

    // Create a minimal tsconfig.json
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
    // Partial defined in a separate file
    await writeFile(
      join(dir, 'src', 'fragments', 'user.js'),
      `import { gazania } from 'gazania'
export const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
    )

    // Query that imports and uses the partial
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

    const { manifest } = await extract({
      dir: 'src',
      hash: sha256,
      cwd: dir,
      tsconfig: 'tsconfig.json',
    })

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

    const { manifest } = await extract({
      dir: 'src',
      hash: sha256,
      cwd: dir,
      tsconfig: 'tsconfig.json',
    })

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

    const { manifest } = await extract({
      dir: 'src',
      hash: sha256,
      cwd: dir,
      tsconfig: 'tsconfig.json',
    })

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

    const { manifest } = await extract({
      dir: 'src',
      hash: sha256,
      cwd: dir,
      tsconfig: 'tsconfig.json',
    })

    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
  })

  it('still extracts simple queries without cross-file dependencies', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('SimpleQuery').select($ => $.select(['id']))`,
    )

    const { manifest } = await extract({
      dir: 'src',
      hash: sha256,
      cwd: dir,
      tsconfig: 'tsconfig.json',
    })

    expect(manifest.operations).toHaveProperty('SimpleQuery')
  })

  it('extracts operations that use cross-file partials when a circular dependency exists', async () => {
    // Regression: index.ts exports the builder AND imports partials from fragments.ts,
    // while fragments.ts imports the builder from index.ts — a circular dependency.
    // The topological sort may process index.ts before fragments.ts, leaving partials
    // unresolved on the first pass. A second pass is required to resolve the query.
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

    const { manifest } = await extract({
      dir: 'src',
      hash: sha256,
      cwd: dir,
      tsconfig: 'tsconfig.json',
    })

    expect(manifest.operations).toHaveProperty('GetUsersWithFragment')
    expect(manifest.operations.GetUsersWithFragment!.body).toContain('...UserFields')
    expect(manifest.operations.GetUsersWithFragment!.body).toContain('fragment UserFields on User')
  })

  it('extracts operations from framework files (Vue/Svelte/React) that import gazania from a local module', async () => {
    // Regression: Vue/Svelte/React files import `gazania` from a local module
    // (e.g. `import { gazania } from './index'`) rather than from 'gazania'.
    // Previously these files were skipped because the static analysis
    // returned early when no `import from 'gazania'` was present.
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

    const { manifest } = await extract({
      dir: 'src',
      hash: sha256,
      cwd: dir,
      tsconfig: 'tsconfig.json',
    })

    expect(manifest.operations).toHaveProperty('GetUsers_Vue')
    expect(manifest.operations).toHaveProperty('GetUsers_Svelte')
    expect(manifest.operations).toHaveProperty('GetUsers_React')
  })
})

describe('extract: skipped calls', () => {
  let dir: string

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
    const { skipped } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
    expect(skipped).toHaveLength(0)
  })

  it('throws ExtractionError when a call references an undefined variable', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
    )
    try {
      await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    try {
      await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    try {
      await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    try {
      await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    try {
      await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    const { manifest, skipped } = await extract({
      dir: 'src',
      hash: sha256,
      cwd: dir,
      tsconfig: 'tsconfig.json',
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
    const { skipped } = await extract({
      dir: 'src',
      hash: sha256,
      cwd: dir,
      tsconfig: 'tsconfig.json',
      ignoreCategories: ['unresolved', 'analysis', 'circular'],
    })
    expect(skipped).toHaveLength(1)
  })

  it('ignoreCategories does not suppress non-matching categories', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
    )
    await expect(extract({
      dir: 'src',
      hash: sha256,
      cwd: dir,
      tsconfig: 'tsconfig.json',
      ignoreCategories: ['analysis'],
    })).rejects.toThrow(ExtractionError)
  })

  it('cross-file mode: skipped when imported file is outside the scanned directory', async () => {
    // The fragments file is outside the `src/` scan root, so it is not
    // collected by findFiles and therefore not available as a known file.
    // Because the import cannot be resolved to a known file, the binding
    // never appears in the cross-file bindings and the query fails to evaluate.
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
    // query.ts imports from outside the scanned src/ directory
    await writeFile(
      join(dir, 'src', 'query.ts'),
      `import { myPartial } from '../fragments/user'\nimport { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select([...myPartial({})]))`,
    )
    const { manifest, skipped } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json', ignoreCategories: ['unresolved'] })
    expect(manifest.operations).not.toHaveProperty('GetUser')
    expect(skipped).toHaveLength(1)
    expect(skipped[0]!.reason).toMatch(/myPartial is not defined/)
    expect(skipped[0]!.category).toBe('unresolved')
  })
})

describe('extract: integration', () => {
  let dir: string

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
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    await expect(extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' }))
      .rejects
      .toThrow(/Duplicate operation name "DupQuery"/)
  })

  it('silently skips duplicate operations with identical bodies across files', async () => {
    const queryCode = `import { gazania } from 'gazania'\nconst doc = gazania.query('SameQuery').select($ => $.select(['id']))`
    await writeFile(join(dir, 'src', 'a.js'), queryCode)
    await writeFile(join(dir, 'src', 'b.js'), queryCode)
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
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
    const { manifest } = await extract({ dir: 'src', hash: sha256, cwd: dir, tsconfig: 'tsconfig.json' })
    const entry = manifest.operations.LineQuery
    expect(entry).toBeDefined()
    // The gazania.query call is on line 4
    expect(entry!.loc.start.line).toBeGreaterThanOrEqual(3)
  })
})

describe('oxc parsing', () => {
  it('parses plain JavaScript', async () => {
    const { parseSync } = await import('oxc-parser')
    const result = parseSync('test.js', `const x = 1`)
    expect(result.errors).toHaveLength(0)
    expect(result.program.type).toBe('Program')
  })

  it('parses JSX', async () => {
    const { parseSync } = await import('oxc-parser')
    const result = parseSync('test.jsx', `const App = () => <div>hello</div>`)
    expect(result.errors).toHaveLength(0)
    expect(result.program.type).toBe('Program')
  })

  it('parses TypeScript directly', async () => {
    const { parseSync } = await import('oxc-parser')
    const result = parseSync('test.ts', `const x: string = 'hello'`)
    expect(result.errors).toHaveLength(0)
    expect(result.program.type).toBe('Program')
  })

  it('parses TypeScript + JSX', async () => {
    const { parseSync } = await import('oxc-parser')
    const result = parseSync('test.tsx', `const x: string = 'hello'; const App = () => <div />`)
    expect(result.errors).toHaveLength(0)
    expect(result.program.type).toBe('Program')
  })
})

describe('oxc-transform', () => {
  it('strips TypeScript type annotations', async () => {
    const { transformSync } = await import('oxc-transform')
    const result = transformSync('test.ts', `const x: string = 'hello'\nfunction f(a: number): void {}`)
    expect(result.errors).toHaveLength(0)
    expect(result.code).not.toContain(': string')
    expect(result.code).not.toContain(': number')
    expect(result.code).toContain('hello')
  })

  it('handles TSX', async () => {
    const { transformSync } = await import('oxc-transform')
    const result = transformSync('test.tsx', `interface User { id: string }\nfunction App() { return <div /> }`)
    expect(result.errors).toHaveLength(0)
    expect(result.code).not.toContain('interface User')
    expect(result.code).not.toContain(': string')
  })
})
