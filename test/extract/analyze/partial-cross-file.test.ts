import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { staticExtractCrossFile } from '../../../src/extract/analyze/pipeline'
import { loadTS, parseTSConfig } from '../../../src/extract/ts-program'
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

it('1. basic cross-file partial', () => {
  const baseDir = '/vfs/crossfile'
  const files: Record<string, string> = {
    [`${baseDir}/tsconfig.json`]: makeTSConfig(),
    [`${baseDir}/src/fragments/user.ts`]:
      `import { gazania } from 'gazania'
export const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
    [`${baseDir}/src/query.ts`]:
      `import { gazania } from 'gazania'
import { userPartial } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
  }

  const system = createTestingSystem(files, ts)
  const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
  const { manifest } = staticExtractCrossFile(
    [`${baseDir}/src/fragments/user.ts`, `${baseDir}/src/query.ts`],
    { tsconfig: parsed, hash: sha256, ts, system, compilers: [] },
  )
  expect(manifest.operations).toHaveProperty('GetUser')
  expect(manifest.operations.GetUser.body).toContain('...UserFields')
  expect(manifest.operations.GetUser.body).toContain('id')
  expect(manifest.operations.GetUser.body).toContain('name')
})

it('2. cross-file section', () => {
  const baseDir = '/vfs/crossfile'
  const files: Record<string, string> = {
    [`${baseDir}/tsconfig.json`]: makeTSConfig(),
    [`${baseDir}/src/fragments/user.ts`]:
      `import { gazania } from 'gazania'
export const userSection = gazania.section('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
    [`${baseDir}/src/query.ts`]:
      `import { gazania } from 'gazania'
import { userSection } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userSection({}),
    ]),
  }]))`,
  }

  const system = createTestingSystem(files, ts)
  const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
  const { manifest } = staticExtractCrossFile(
    [`${baseDir}/src/fragments/user.ts`, `${baseDir}/src/query.ts`],
    { tsconfig: parsed, hash: sha256, ts, system, compilers: [] },
  )
  expect(manifest.operations).toHaveProperty('GetUser')
  expect(manifest.operations.GetUser.body).toContain('...UserFields')
  expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
})

it('3. multiple cross-file partials from different files', () => {
  const baseDir = '/vfs/crossfile'
  const files: Record<string, string> = {
    [`${baseDir}/tsconfig.json`]: makeTSConfig(),
    [`${baseDir}/src/fragments/name.ts`]:
      `import { gazania } from 'gazania'
export const namePartial = gazania.partial('UserName')
  .on('User')
  .select($ => $.select(['name']))`,
    [`${baseDir}/src/fragments/email.ts`]:
      `import { gazania } from 'gazania'
export const emailPartial = gazania.partial('UserEmail')
  .on('User')
  .select($ => $.select(['email']))`,
    [`${baseDir}/src/query.ts`]:
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
  }

  const system = createTestingSystem(files, ts)
  const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
  const { manifest } = staticExtractCrossFile(
    [`${baseDir}/src/fragments/name.ts`, `${baseDir}/src/fragments/email.ts`, `${baseDir}/src/query.ts`],
    { tsconfig: parsed, hash: sha256, ts, system, compilers: [] },
  )
  expect(manifest.operations).toHaveProperty('GetUser')
  expect(manifest.operations.GetUser.body).toContain('...UserName')
  expect(manifest.operations.GetUser.body).toContain('...UserEmail')
  expect(manifest.operations.GetUser.body).toContain('fragment UserName on User')
  expect(manifest.operations.GetUser.body).toContain('fragment UserEmail on User')
})

it('4. re-exported partial with alias', () => {
  const baseDir = '/vfs/crossfile'
  const files: Record<string, string> = {
    [`${baseDir}/tsconfig.json`]: makeTSConfig(),
    [`${baseDir}/src/fragments/user.ts`]:
      `import { gazania } from 'gazania'
const _userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
export { _userPartial as userPartial }`,
    [`${baseDir}/src/query.ts`]:
      `import { gazania } from 'gazania'
import { userPartial } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
  }

  const system = createTestingSystem(files, ts)
  const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
  const { manifest } = staticExtractCrossFile(
    [`${baseDir}/src/fragments/user.ts`, `${baseDir}/src/query.ts`],
    { tsconfig: parsed, hash: sha256, ts, system, compilers: [] },
  )
  expect(manifest.operations).toHaveProperty('GetUser')
  expect(manifest.operations.GetUser.body).toContain('...UserFields')
  expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
})

it('5. circular dependency (second pass resolves)', () => {
  const baseDir = '/vfs/crossfile'
  const files: Record<string, string> = {
    [`${baseDir}/tsconfig.json`]: makeTSConfig(),
    [`${baseDir}/src/index.ts`]:
      `import { createGazania } from 'gazania'
import { userPartial } from './fragments'
export const gazania = createGazania('https://example.com/graphql')
export const GetUsersWithFragment = gazania.query('GetUsersWithFragment')
  .select($ => $.select([{
    users: $ => $.select([...userPartial({})]),
  }]))`,
    [`${baseDir}/src/fragments.ts`]:
      `import { gazania } from './index'
export const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
  }

  const system = createTestingSystem(files, ts)
  const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
  const { manifest } = staticExtractCrossFile(
    [`${baseDir}/src/index.ts`, `${baseDir}/src/fragments.ts`],
    { tsconfig: parsed, hash: sha256, ts, system, compilers: [] },
  )
  expect(manifest.operations).toHaveProperty('GetUsersWithFragment')
  expect(manifest.operations.GetUsersWithFragment.body).toContain('...UserFields')
  expect(manifest.operations.GetUsersWithFragment.body).toContain('fragment UserFields on User')
})

it('6. framework files (Vue/Svelte/React) with builder from local module', () => {
  const baseDir = '/vfs/crossfile'
  const files: Record<string, string> = {
    [`${baseDir}/tsconfig.json`]: makeTSConfig(),
    [`${baseDir}/src/index.ts`]:
      `import { createGazania } from 'gazania'
export const gazania = createGazania('https://example.com/graphql')`,
    [`${baseDir}/src/App.vue`]:
      `<script setup lang="ts">
import { gazania } from './index'
const VueQuery = gazania.query('GetUsers_Vue').select($ => $.select(['id', 'name']))
</script>
<template><div /></template>`,
    [`${baseDir}/src/App.svelte`]:
      `<script lang="ts">
import { gazania } from './index'
const SvelteQuery = gazania.query('GetUsers_Svelte').select($ => $.select(['id', 'name']))
</script>
<main />`,
    [`${baseDir}/src/react.tsx`]:
      `import { gazania } from './index'
const ReactQuery = gazania.query('GetUsers_React').select($ => $.select(['id', 'name']))`,
  }

  const system = createTestingSystem(files, ts)
  const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
  const { manifest } = staticExtractCrossFile(
    [`${baseDir}/src/index.ts`, `${baseDir}/src/App.vue`, `${baseDir}/src/App.svelte`, `${baseDir}/src/react.tsx`],
    { tsconfig: parsed, hash: sha256, ts, system, compilers: [] },
  )
  expect(manifest.operations).toHaveProperty('GetUsers_Svelte')
  expect(manifest.operations).toHaveProperty('GetUsers_React')
})

it('7. three-level chain: a uses b\'s partial, b\'s partial uses c\'s partial', () => {
  const baseDir = '/vfs/crossfile'
  const files: Record<string, string> = {
    [`${baseDir}/tsconfig.json`]: makeTSConfig(),
    [`${baseDir}/src/fragments/post.ts`]:
      `import { gazania } from 'gazania'
export const postFields = gazania.partial('PostFields')
  .on('Post')
  .select($ => $.select(['title', 'content']))`,
    [`${baseDir}/src/fragments/user.ts`]:
      `import { gazania } from 'gazania'
import { postFields } from './post'
export const userFields = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select([{
    posts: $ => $.select([
      ...postFields({}),
    ]),
  }]))`,
    [`${baseDir}/src/query.ts`]:
      `import { gazania } from 'gazania'
import { userFields } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userFields({}),
    ]),
  }]))`,
  }

  const system = createTestingSystem(files, ts)
  const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
  const { manifest } = staticExtractCrossFile(
    [
      `${baseDir}/src/fragments/post.ts`,
      `${baseDir}/src/fragments/user.ts`,
      `${baseDir}/src/query.ts`,
    ],
    { tsconfig: parsed, hash: sha256, ts, system, compilers: [] },
  )
  expect(manifest.operations).toHaveProperty('GetUser')
  expect(manifest.operations.GetUser!.body).toContain('...UserFields')
  expect(manifest.operations.GetUser!.body).toContain('fragment UserFields on User')
  expect(manifest.operations.GetUser!.body).toContain('...PostFields')
  expect(manifest.operations.GetUser!.body).toContain('fragment PostFields on Post')
  expect(manifest.operations.GetUser!.body).toContain('title')
  expect(manifest.operations.GetUser!.body).toContain('content')
})

it('8. simple query regression (no cross-file deps)', () => {
  const baseDir = '/vfs/crossfile'
  const files: Record<string, string> = {
    [`${baseDir}/tsconfig.json`]: makeTSConfig(),
    [`${baseDir}/src/query.ts`]:
      `import { gazania } from 'gazania'
const doc = gazania.query('SimpleQuery').select($ => $.select(['id']))`,
  }

  const system = createTestingSystem(files, ts)
  const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, system)
  const { manifest } = staticExtractCrossFile(
    [`${baseDir}/src/query.ts`],
    { tsconfig: parsed, hash: sha256, ts, system, compilers: [] },
  )
  expect(manifest.operations).toHaveProperty('SimpleQuery')
  expect(manifest.operations.SimpleQuery.body).toContain('query SimpleQuery')
  expect(manifest.operations.SimpleQuery.body).toContain('id')
})
