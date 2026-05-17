import type { CreateHostFn } from '../../src/extract/ts-program'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extract } from '../../src/extract'
import { ExtractionError } from '../../src/extract/manifest'
import { createHostFromSystem, loadTS, parseTSConfig } from '../../src/extract/ts-program'
import { createTestingSystem, createVFS } from '../utils/vfs'

const ts = await loadTS()
const projectRoot = resolve(process.cwd())

const sha256 = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`

function makeTSConfig(extra?: Record<string, any>) {
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
    ...extra,
  })
}

function setupExtract(baseDir: string, files: Record<string, string>) {
  const testingSystem = createTestingSystem(files, ts)
  const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, testingSystem)
  const vfs = createVFS(files)
  const createHost: CreateHostFn = (ts, _sys, opts) => createHostFromSystem(ts, testingSystem, opts)
  return { parsed, vfs, createHost }
}

describe('extract', () => {
  const baseDir = '/vfs/extract'

  it('returns an empty manifest when no gazania files found', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/index.ts`]: 'const x = 1',
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toEqual({})
    expect(manifest.fragments).toEqual({})
  })

  it('extracts a simple query from a JS file', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
const doc = gazania.query('TestQuery').select($ => $.select(['id', 'name']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('TestQuery')
    expect(manifest.operations.TestQuery.body).toContain('query TestQuery')
    expect(manifest.operations.TestQuery.hash).toMatch(/^sha256:/)
  })

  it('extracts a mutation', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/mutation.ts`]: `import { gazania } from 'gazania'
const doc = gazania.mutation('CreateUser')
  .vars({ input: 'CreateUserInput!' })
  .select(($, vars) => $.select([{ createUser: $ => $.args({ input: vars.input }).select(['id']) }]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('CreateUser')
    expect(manifest.operations.CreateUser.body).toContain('mutation CreateUser')
  })

  it('extracts a fragment', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/fragment.ts`]: `import { gazania } from 'gazania'
const doc = gazania.fragment('UserFields').on('User').select($ => $.select(['id', 'name']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.fragments).toHaveProperty('UserFields')
    expect(manifest.fragments.UserFields.body).toContain('fragment UserFields on User')
  })

  it('extracts multiple queries from multiple files', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/a.ts`]: `import { gazania } from 'gazania'\nconst doc = gazania.query('QueryA').select($ => $.select(['fieldA']))`,
      [`${baseDir}/src/b.ts`]: `import { gazania } from 'gazania'\nconst doc = gazania.query('QueryB').select($ => $.select(['fieldB']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('QueryA')
    expect(manifest.operations).toHaveProperty('QueryB')
  })

  it('handles files that cannot be parsed', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/broken.ts`]: 'this is not valid javascript {{{',
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toEqual({})
  })

  it('supports different hash algorithms', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'\nconst doc = gazania.query('TestQuery').select($ => $.select(['id']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: (body: string) => `md5:${createHash('md5').update(body).digest('hex')}`, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations.TestQuery.hash).toMatch(/^md5:/)
  })

  it('propagates errors from the hash function', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'\nconst doc = gazania.query('TestQuery').select($ => $.select(['id']))`,
    }
    const brokenHash = () => {
      throw new Error('hash failed')
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    await expect(extract({ dir: `${baseDir}/src`, hash: brokenHash, tsconfig: parsed, fs: vfs, createHost }))
      .rejects
      .toThrow('hash failed')
  })

  it('extracts a query from a .vue <script setup> block', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/Comp.vue`]: `<template><div/></template>
<script setup>
import { gazania } from 'gazania'
const VueQuery = gazania.query('VueQuery').select($ => $.select(['id']))
</script>`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, include: '**/*.{vue}', hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('VueQuery')
  })

  it('extracts queries from both <script> and <script setup> in a .vue file', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/Comp.vue`]: `<template><div/></template>
<script>
import { gazania } from 'gazania'
const VueFrag = gazania.fragment('VueFrag').on('User').select($ => $.select(['id']))
</script>
<script setup>
import { gazania } from 'gazania'
const VueSetupQuery = gazania.query('VueSetupQuery').select($ => $.select(['name']))
</script>`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, include: '**/*.{vue}', hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.fragments).toHaveProperty('VueFrag')
    expect(manifest.operations).toHaveProperty('VueSetupQuery')
  })

  it('extracts a query from a .svelte <script> block', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/Comp.svelte`]: `<script>
import { gazania } from 'gazania'
const SvelteQuery = gazania.query('SvelteQuery').select($ => $.select(['id']))
</script>
<main />`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, include: '**/*.{svelte}', hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('SvelteQuery')
  })

  it('extracts a query from a .ts file with type annotations', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { createGazania } from 'gazania'
const API: string = 'https://api.example.com/graphql'
const gazania = createGazania(API)
const TypedQuery = gazania.query('TypedQuery').select($ => $.select(['id']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('TypedQuery')
  })

  it('extracts a query from a .tsx file with JSX and TypeScript types', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/App.tsx`]: `import { createGazania } from 'gazania'
const API = 'https://api.example.com/graphql'
const gazania = createGazania(API)
const TsxQuery = gazania.query('TsxQuery').select($ => $.select(['id']))
interface User { id: string }
function App() { return <div /> }`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('TsxQuery')
  })

  it('extracts a query that uses a same-file partial', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
    expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
  })

  it('extracts a query that uses a same-file section', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
const userSection = gazania.section('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userSection({}),
    ]),
  }]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
  })

  it('extracts a query using multiple same-file partials', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
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
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserName')
    expect(manifest.operations.GetUser.body).toContain('...UserEmail')
  })
})

describe('extract with tsconfig (cross-file)', () => {
  const baseDir = '/vfs/extract-crossfile'

  it('extracts a query that uses a cross-file partial', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/fragments/user.ts`]: `import { gazania } from 'gazania'
export const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
import { userPartial } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
    expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
  })

  it('extracts a query that uses a cross-file section', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/fragments/user.ts`]: `import { gazania } from 'gazania'
export const userSection = gazania.section('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
import { userSection } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userSection({}),
    ]),
  }]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
  })

  it('extracts with multiple cross-file partials from different files', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/fragments/name.ts`]: `import { gazania } from 'gazania'
export const namePartial = gazania.partial('UserName')
  .on('User')
  .select($ => $.select(['name']))`,
      [`${baseDir}/src/fragments/email.ts`]: `import { gazania } from 'gazania'
export const emailPartial = gazania.partial('UserEmail')
  .on('User')
  .select($ => $.select(['email']))`,
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
import { namePartial } from './fragments/name'
import { emailPartial } from './fragments/email'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...namePartial({}),
      ...emailPartial({}),
    ]),
  }]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserName')
    expect(manifest.operations.GetUser.body).toContain('...UserEmail')
  })

  it('handles re-exported partials with alias', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/fragments/user.ts`]: `import { gazania } from 'gazania'
const _userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
export { _userPartial as userPartial }`,
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
import { userPartial } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
  })

  it('still extracts simple queries without cross-file dependencies', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
const doc = gazania.query('SimpleQuery').select($ => $.select(['id']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('SimpleQuery')
  })

  it('extracts operations that use cross-file partials when a circular dependency exists', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/index.ts`]: `import { createGazania } from 'gazania'
import { userPartial } from './fragments'
export const gazania = createGazania('https://example.com/graphql')
export const GetUsersWithFragment = gazania.query('GetUsersWithFragment')
  .select($ => $.select([{
    users: $ => $.select([...userPartial({})]),
  }]))`,
      [`${baseDir}/src/fragments.ts`]: `import { gazania } from './index'
export const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('GetUsersWithFragment')
    expect(manifest.operations.GetUsersWithFragment!.body).toContain('...UserFields')
    expect(manifest.operations.GetUsersWithFragment!.body).toContain('fragment UserFields on User')
  })

  it('extracts operations from framework files (Vue/Svelte/React) that import gazania from a local module', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/index.ts`]: `import { createGazania } from 'gazania'
export const gazania = createGazania('https://example.com/graphql')`,
      [`${baseDir}/src/App.vue`]: `<script setup lang="ts">
import { gazania } from './index'
const VueQuery = gazania.query('GetUsers_Vue').select($ => $.select(['id', 'name']))
</script>
<template><div /></template>`,
      [`${baseDir}/src/App.svelte`]: `<script lang="ts">
import { gazania } from './index'
const SvelteQuery = gazania.query('GetUsers_Svelte').select($ => $.select(['id', 'name']))
</script>
<main />`,
      [`${baseDir}/src/react.tsx`]: `import { gazania } from './index'
const ReactQuery = gazania.query('GetUsers_React').select($ => $.select(['id', 'name']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('GetUsers_Vue')
    expect(manifest.operations).toHaveProperty('GetUsers_Svelte')
    expect(manifest.operations).toHaveProperty('GetUsers_React')
  })
})

describe('extract: skipped calls', () => {
  const baseDir = '/vfs/extract-skipped'

  it('returns empty skipped array when all calls succeed', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'\nconst doc = gazania.query('OkQuery').select($ => $.select(['id']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { skipped } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(skipped).toHaveLength(0)
  })

  it('throws ExtractionError when a call references an undefined variable', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    try {
      await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
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

  it('extractionError.skipped entry has the relative file path', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'\nconst doc = gazania.query('X').select($ => $.select([...gone({})]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    try {
      await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect(err).toBeInstanceOf(ExtractionError)
      expect((err as ExtractionError).skipped[0]!.file).toBe('query.ts')
    }
  })

  it('extractionError.skipped entry has a 1-based line number pointing to the failing call', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'\n\nconst doc = gazania.query('LineTest').select($ => $.select([...gone({})]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    try {
      await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect(err).toBeInstanceOf(ExtractionError)
      expect((err as ExtractionError).skipped[0]!.line).toBe(3)
    }
  })

  it('extractionError.skipped entry line number accounts for SFC lineOffset in Vue files', async () => {
    const vue = `<template><div/></template>\n<script setup>\nimport { gazania } from 'gazania'\nconst doc = gazania.query('VueFail').select($ => $.select([...gone({})]))\n</script>`
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/Comp.vue`]: vue,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    try {
      await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect(err).toBeInstanceOf(ExtractionError)
      expect((err as ExtractionError).skipped[0]!.line).toBe(4)
    }
  })

  it('collects skipped calls from multiple files in ExtractionError', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/a.ts`]: `import { gazania } from 'gazania'\nconst d = gazania.query('A').select($ => $.select([...x({})]))`,
      [`${baseDir}/src/b.ts`]: `import { gazania } from 'gazania'\nconst d = gazania.query('B').select($ => $.select([...y({})]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    try {
      await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect(err).toBeInstanceOf(ExtractionError)
      const skipped = (err as ExtractionError).skipped
      expect(skipped).toHaveLength(2)
      const files = skipped.map(s => s.file)
      expect(files.some(f => f.endsWith('a.ts'))).toBe(true)
      expect(files.some(f => f.endsWith('b.ts'))).toBe(true)
    }
  })

  it('ignoreCategories suppresses ExtractionError for matching categories', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest, skipped } = await extract({
      dir: `${baseDir}/src`,
      hash: sha256,
      tsconfig: parsed,
      fs: vfs,
      createHost,
      ignoreCategories: ['unresolved'],
    })
    expect(manifest.operations).not.toHaveProperty('FailQuery')
    expect(skipped).toHaveLength(1)
    expect(skipped[0]!.category).toBe('unresolved')
  })

  it('ignoreCategories with all categories suppresses all errors', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { skipped } = await extract({
      dir: `${baseDir}/src`,
      hash: sha256,
      tsconfig: parsed,
      fs: vfs,
      createHost,
      ignoreCategories: ['unresolved', 'analysis', 'circular'],
    })
    expect(skipped).toHaveLength(1)
  })

  it('ignoreCategories does not suppress non-matching categories', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    await expect(extract({
      dir: `${baseDir}/src`,
      hash: sha256,
      tsconfig: parsed,
      fs: vfs,
      createHost,
      ignoreCategories: ['analysis'],
    })).rejects.toThrow(ExtractionError)
  })

  it('cross-file mode: skipped when imported file is outside the scanned directory', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: JSON.stringify({
        compilerOptions: {
          target: 'esnext',
          moduleResolution: 'bundler',
          baseUrl: projectRoot,
          paths: {
            gazania: ['src/index.ts'],
          },
        },
        include: ['src', 'fragments'],
      }),
      [`${baseDir}/fragments/user.ts`]: `import { gazania } from 'gazania'\nexport const myPartial = gazania.partial('User').on('User').select($ => $.select(['id']))`,
      [`${baseDir}/src/query.ts`]: `import { myPartial } from '../fragments/user'\nimport { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select([...myPartial({})]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest, skipped } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost, ignoreCategories: ['unresolved'] })
    expect(manifest.operations).not.toHaveProperty('GetUser')
    expect(skipped).toHaveLength(1)
    expect(skipped[0]!.reason).toMatch(/myPartial is not defined/)
    expect(skipped[0]!.category).toBe('unresolved')
  })
})

describe('extract: integration', () => {
  const baseDir = '/vfs/extract-integration'

  it('manifest entries contain loc field', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
const doc = gazania.query('LocQuery').select($ => $.select(['id', 'name']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    const entry = manifest.operations.LocQuery
    expect(entry).toBeDefined()
    expect(entry!.locs).toBeDefined()
    expect(entry!.locs[0]!.start.line).toBeGreaterThanOrEqual(1)
    expect(entry!.locs[0]!.start.column).toBeGreaterThanOrEqual(1)
    expect(entry!.locs[0]!.end.line).toBeGreaterThanOrEqual(entry!.locs[0]!.start.line)
    expect(entry!.locs[0]!.start.offset).toBeGreaterThanOrEqual(0)
    expect(entry!.locs[0]!.end.offset).toBeGreaterThanOrEqual(entry!.locs[0]!.start.offset)
  })

  it('throws for duplicate operation names with different bodies across files', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/a.ts`]: `import { gazania } from 'gazania'
const doc = gazania.query('DupQuery').select($ => $.select(['id']))`,
      [`${baseDir}/src/b.ts`]: `import { gazania } from 'gazania'
const doc = gazania.query('DupQuery').select($ => $.select(['name']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    await expect(extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost }))
      .rejects
      .toThrow(/Duplicate operation name "DupQuery"/)
  })

  it('silently skips duplicate operations with identical bodies across files', async () => {
    const queryCode = `import { gazania } from 'gazania'\nconst doc = gazania.query('SameQuery').select($ => $.select(['id']))`
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/a.ts`]: queryCode,
      [`${baseDir}/src/b.ts`]: queryCode,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(Object.keys(manifest.operations)).toHaveLength(1)
    expect(manifest.operations).toHaveProperty('SameQuery')
  })

  it('loc field points to the correct source line', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `// comment line 1
// comment line 2
import { gazania } from 'gazania'
const doc = gazania.query('LineQuery').select($ => $.select(['id']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    const entry = manifest.operations.LineQuery
    expect(entry).toBeDefined()
    expect(entry!.locs[0]!.start.line).toBeGreaterThanOrEqual(3)
  })

  it('loc has exact line/column for a .ts file (SourceFile reuse path)', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
const doc = gazania.query('ExactLoc').select($ => $.select(['id']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    const entry = manifest.operations.ExactLoc
    expect(entry).toBeDefined()
    expect(entry!.locs[0]!.start.line).toBe(2)
    expect(entry!.locs[0]!.start.column).toBeGreaterThanOrEqual(1)
    expect(entry!.locs[0]!.end.line).toBe(2)
    expect(entry!.locs[0]!.end.offset).toBeGreaterThan(entry!.locs[0]!.start.offset)
    expect(entry!.locs[0]!.file).toContain('query.ts')
  })

  it('loc has exact line/column for a .vue SFC file (with lineOffset)', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/Comp.vue`]: `<template><div/></template>
<script>
import { gazania } from 'gazania'
const doc = gazania.query('VueLoc').select($ => $.select(['id']))
</script>`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, include: '**/*.{vue}', hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    const entry = manifest.operations.VueLoc
    expect(entry).toBeDefined()
    expect(entry!.locs[0]!.start.line).toBe(4)
    expect(entry!.locs[0]!.start.column).toBeGreaterThanOrEqual(1)
    expect(entry!.locs[0]!.end.line).toBe(4)
    expect(entry!.locs[0]!.file).toContain('Comp.vue')
  })

  it('loc has exact line/column for a .svelte file (with lineOffset)', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/App.svelte`]: `<script>
import { gazania } from 'gazania'
const doc = gazania.query('SvelteLoc').select($ => $.select(['id']))
</script>
<main />`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, include: '**/*.{svelte}', hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    const entry = manifest.operations.SvelteLoc
    expect(entry).toBeDefined()
    expect(entry!.locs[0]!.start.line).toBe(3)
    expect(entry!.locs[0]!.start.column).toBeGreaterThanOrEqual(1)
    expect(entry!.locs[0]!.end.line).toBe(3)
    expect(entry!.locs[0]!.file).toContain('App.svelte')
  })

  it('loc end is after start for a multi-line chained call', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { gazania } from 'gazania'
const doc = gazania
  .query('MultiLine')
  .select($ => $.select(['id']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    const entry = manifest.operations.MultiLine
    expect(entry).toBeDefined()
    expect(entry!.locs[0]!.start.line).toBe(2)
    expect(entry!.locs[0]!.end.line).toBe(4)
    expect(entry!.locs[0]!.end.offset).toBeGreaterThan(entry!.locs[0]!.start.offset)
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
  const baseDir = '/vfs/extract-auto-import'
  const autoImportDTS = [
    'import type { gazania } from \'gazania\'',
    'declare global {',
    '  const schema: typeof gazania',
    '}',
    'export {}',
  ].join('\n')

  it('extracts a query from a .ts file using an auto-imported builder', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/auto-imports.d.ts`]: autoImportDTS,
      [`${baseDir}/src/query.ts`]: `const doc = schema.query('AutoImportTs').select($ => $.select(['id']))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('AutoImportTs')
    expect(manifest.operations.AutoImportTs!.body).toContain('query AutoImportTs')
  })

  it('extracts a query from a .vue file using an auto-imported builder', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/auto-imports.d.ts`]: autoImportDTS,
      [`${baseDir}/src/Comp.vue`]: `<template><div /></template>\n<script setup lang="ts">\nconst doc = schema.query('AutoImportVue').select($ => $.select(['id']))\n</script>`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('AutoImportVue')
    expect(manifest.operations.AutoImportVue!.body).toContain('query AutoImportVue')
  })

  it('extracts a query from a .svelte file using an auto-imported builder', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/auto-imports.d.ts`]: autoImportDTS,
      [`${baseDir}/src/Comp.svelte`]: `<script lang="ts">\nconst doc = schema.query('AutoImportSvelte').select($ => $.select(['id']))\n</script>\n<main />`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('AutoImportSvelte')
    expect(manifest.operations.AutoImportSvelte!.body).toContain('query AutoImportSvelte')
  })

  it('extracts queries from .ts, .vue, and .svelte files simultaneously', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/auto-imports.d.ts`]: autoImportDTS,
      [`${baseDir}/src/query.ts`]: `const doc = schema.query('AutoImportTs').select($ => $.select(['id']))`,
      [`${baseDir}/src/Comp.vue`]: `<template><div /></template>\n<script setup lang="ts">\nconst doc = schema.query('AutoImportVue').select($ => $.select(['name']))\n</script>`,
      [`${baseDir}/src/Comp.svelte`]: `<script lang="ts">\nconst doc = schema.query('AutoImportSvelte').select($ => $.select(['email']))\n</script>\n<main />`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('AutoImportTs')
    expect(manifest.operations).toHaveProperty('AutoImportVue')
    expect(manifest.operations).toHaveProperty('AutoImportSvelte')
  })

  it('ignores files that have no queries even with the global builder in scope', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/auto-imports.d.ts`]: autoImportDTS,
      [`${baseDir}/src/no-queries.ts`]: `// schema is available but no queries are defined here\nconst x = 1`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(Object.keys(manifest.operations)).toHaveLength(0)
  })

  it('expands an auto-imported partial in a query that uses it', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/auto-imports.d.ts`]: autoImportDTS,
      [`${baseDir}/src/partial.ts`]: `export const userPartial = schema.partial('UserFields').on('User').select($ => $.select(['id', 'name']))`,
      [`${baseDir}/src/query.ts`]: `import { userPartial } from './partial'
const doc = schema.query('AutoImportPartial').select($ => $.select([{
  user: $ => $.select([...userPartial({})]),
}]))`,
    }
    const { parsed, vfs, createHost } = setupExtract(baseDir, files)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs: vfs, createHost })
    expect(manifest.operations).toHaveProperty('AutoImportPartial')
    expect(manifest.operations.AutoImportPartial!.body).toContain('...UserFields')
    expect(manifest.operations.AutoImportPartial!.body).toContain('fragment UserFields on User')
  })
})
