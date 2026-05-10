import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { staticExtractCrossFile } from '../../../src/extract/analyze/pipeline'

const sha256 = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`

describe('staticExtractCrossFile: cross-file partial/section resolution', () => {
  let dir: string

  beforeEach(async () => {
    dir = join(tmpdir(), `gazania-static-crossfile-test-${randomUUID()}`)
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

  it('1. basic cross-file partial', async () => {
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

    const { manifest } = await staticExtractCrossFile(
      [join(dir, 'src', 'fragments', 'user.js'), join(dir, 'src', 'query.js')],
      { tsconfigPath: join(dir, 'tsconfig.json'), hash: sha256 },
    )

    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
    expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
    expect(manifest.operations.GetUser.body).toContain('id')
    expect(manifest.operations.GetUser.body).toContain('name')
  })

  it('2. cross-file section', async () => {
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

    const { manifest } = await staticExtractCrossFile(
      [join(dir, 'src', 'fragments', 'user.js'), join(dir, 'src', 'query.js')],
      { tsconfigPath: join(dir, 'tsconfig.json'), hash: sha256 },
    )

    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
    expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
  })

  it('3. multiple cross-file partials from different files', async () => {
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

    const { manifest } = await staticExtractCrossFile(
      [join(dir, 'src', 'fragments', 'name.js'), join(dir, 'src', 'fragments', 'email.js'), join(dir, 'src', 'query.js')],
      { tsconfigPath: join(dir, 'tsconfig.json'), hash: sha256 },
    )

    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserName')
    expect(manifest.operations.GetUser.body).toContain('...UserEmail')
    expect(manifest.operations.GetUser.body).toContain('fragment UserName on User')
    expect(manifest.operations.GetUser.body).toContain('fragment UserEmail on User')
  })

  it('4. re-exported partial with alias', async () => {
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

    const { manifest } = await staticExtractCrossFile(
      [join(dir, 'src', 'fragments', 'user.js'), join(dir, 'src', 'query.js')],
      { tsconfigPath: join(dir, 'tsconfig.json'), hash: sha256 },
    )

    expect(manifest.operations).toHaveProperty('GetUser')
    expect(manifest.operations.GetUser.body).toContain('...UserFields')
    expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
  })

  it('5. circular dependency (second pass resolves)', async () => {
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

    const { manifest } = await staticExtractCrossFile(
      [join(dir, 'src', 'index.ts'), join(dir, 'src', 'fragments.ts')],
      { tsconfigPath: join(dir, 'tsconfig.json'), hash: sha256 },
    )

    expect(manifest.operations).toHaveProperty('GetUsersWithFragment')
    expect(manifest.operations.GetUsersWithFragment.body).toContain('...UserFields')
    expect(manifest.operations.GetUsersWithFragment.body).toContain('fragment UserFields on User')
  })

  it('6. framework files (Vue/Svelte/React) with builder from local module', async () => {
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

    const { manifest } = await staticExtractCrossFile(
      [join(dir, 'src', 'index.ts'), join(dir, 'src', 'App.vue'), join(dir, 'src', 'App.svelte'), join(dir, 'src', 'react.tsx')],
      { tsconfigPath: join(dir, 'tsconfig.json'), hash: sha256 },
    )

    expect(manifest.operations).toHaveProperty('GetUsers_Vue')
    expect(manifest.operations).toHaveProperty('GetUsers_Svelte')
    expect(manifest.operations).toHaveProperty('GetUsers_React')
  })

  it('7. three-level chain: a uses b\'s partial, b\'s partial uses c\'s partial', async () => {
    // c.js: defines postFields partial
    await writeFile(
      join(dir, 'src', 'fragments', 'post.js'),
      `import { gazania } from 'gazania'
export const postFields = gazania.partial('PostFields')
  .on('Post')
  .select($ => $.select(['title', 'content']))`,
    )

    // b.js: defines userFields partial that internally uses postFields
    await writeFile(
      join(dir, 'src', 'fragments', 'user.js'),
      `import { gazania } from 'gazania'
import { postFields } from './post'
export const userFields = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select([{
    posts: $ => $.select([
      ...postFields({}),
    ]),
  }]))`,
    )

    // a.js: query that uses userFields (which transitively depends on postFields)
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
import { userFields } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userFields({}),
    ]),
  }]))`,
    )

    const { manifest } = await staticExtractCrossFile(
      [
        join(dir, 'src', 'fragments', 'post.js'),
        join(dir, 'src', 'fragments', 'user.js'),
        join(dir, 'src', 'query.js'),
      ],
      { tsconfigPath: join(dir, 'tsconfig.json'), hash: sha256 },
    )

    expect(manifest.operations).toHaveProperty('GetUser')
    // UserFields fragment should be included
    expect(manifest.operations.GetUser!.body).toContain('...UserFields')
    expect(manifest.operations.GetUser!.body).toContain('fragment UserFields on User')
    // posts field inside UserFields should contain PostFields spread
    expect(manifest.operations.GetUser!.body).toContain('...PostFields')
    // PostFields fragment definition should also be included
    expect(manifest.operations.GetUser!.body).toContain('fragment PostFields on Post')
    expect(manifest.operations.GetUser!.body).toContain('title')
    expect(manifest.operations.GetUser!.body).toContain('content')
  })

  it('8. simple query regression (no cross-file deps)', async () => {
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'
const doc = gazania.query('SimpleQuery').select($ => $.select(['id']))`,
    )

    const { manifest } = await staticExtractCrossFile(
      [join(dir, 'src', 'query.js')],
      { tsconfigPath: join(dir, 'tsconfig.json'), hash: sha256 },
    )

    expect(manifest.operations).toHaveProperty('SimpleQuery')
    expect(manifest.operations.SimpleQuery.body).toContain('query SimpleQuery')
    expect(manifest.operations.SimpleQuery.body).toContain('id')
  })
})
