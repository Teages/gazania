/**
 * Framework comparison (bundle size): how much does one query cost in the
 * compiled bundle, and what is the fixed runtime cost around it.
 *
 *   node bench/compare/size-compare.mjs
 *
 * For gazania and graphql-tag the per-query cost is the delta between a
 * bundle that merely references the framework and one that also contains the
 * same GetUserDeep query. For @graphql-codegen/client-preset the document map
 * is a single constant and cannot be tree-shaken per operation, so its
 * per-query cost is the delta between the generated map with and without that
 * operation. All bundles go through esbuild (ESM, minified, browser). The
 * `import.meta.vitest` define dead-code-eliminates the inline test blocks in
 * gazania's source.
 */
/* eslint-disable no-console */
import { Buffer } from 'node:buffer'
import { readdirSync } from 'node:fs'
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { executeCodegen } from '@graphql-codegen/cli'
import esbuild from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OPERATIONS_DIR = resolve(__dirname, 'operations')
const GENERATED_DIR = resolve(__dirname, '.generated')
const MINUS_ONE_OPS = resolve(__dirname, '.tmp-ops-minus-one')
const MINUS_ONE_GEN = resolve(__dirname, '.generated-minus-one')

// The query whose compiled size is measured, expressed once per framework:
// 11 fields over 3 levels of nesting (~115 chars of GraphQL).
const QUERY = 'GetUserDeep'

const GAZANIA_QUERY = `
  import { gazania } from '../../src/runtime'
  gazania.query('${QUERY}')
    .vars({ id: 'Int!' })
    .select(($, vars) => $.select([{
      user: $ => $.args({ id: vars.id }).select([
        'id',
        'name',
        {
          sayings: $ => $.select([
            'id',
            'content',
            'category',
            { owner: $ => $.select(['id', 'name', 'email']) },
          ]),
        },
      ]),
    }]))
`

const GQL_TAG_QUERY = `
  import gql from 'graphql-tag'
  gql(\`query ${QUERY}($id: Int!) {
    user(id: $id) {
      id
      name
      sayings {
        id
        content
        category
        owner { id name email }
      }
    }
  }\`)
`

const CODEGEN_QUERY = `
  import { graphql } from './.generated/gql'
  graphql(\`query GetUserDeep($id: Int!) {
  user(id: $id) {
    id
    name
    sayings {
      id
      content
      category
      owner {
        id
        name
        email
      }
    }
  }
}\`)
`

const CODEGEN_BASELINE = `
  import { graphql } from './.generated-minus-one/gql'
  export default graphql
`

async function generate(target, documents) {
  const output = await executeCodegen({
    schema: resolve(__dirname, 'schema.graphql'),
    documents,
    generates: { [`${target}/`]: { preset: 'client', plugins: [] } },
  })
  for (const file of output.result) {
    await mkdir(dirname(file.filename), { recursive: true })
    await writeFile(file.filename, file.content, 'utf8')
  }
}

async function bundle(entry) {
  const result = await esbuild.build({
    stdin: { contents: entry, resolveDir: __dirname, loader: 'ts' },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    define: { 'import.meta.vitest': 'undefined' },
    logLevel: 'silent',
  })
  const code = result.outputFiles[0].text
  return { min: Buffer.byteLength(code), gzip: gzipSync(Buffer.from(code)).length }
}

const FRAMEWORKS = [
  {
    name: 'gazania',
    // `export default` keeps the framework in the bundle (a bare `void`
    // reference is tree-shaken away); it adds identical bytes to both
    // bundles, so the delta is unaffected.
    baseline: `import { gazania } from '../../src/runtime'\nexport default gazania`,
    withQuery: GAZANIA_QUERY,
  },
  {
    name: 'graphql-tag',
    baseline: `import gql from 'graphql-tag'\nexport default gql`,
    withQuery: GQL_TAG_QUERY,
  },
  {
    name: 'codegen client-preset',
    baseline: CODEGEN_BASELINE,
    withQuery: CODEGEN_QUERY,
  },
]

async function main() {
  // Generate the document maps: full (6 ops) and without the measured query
  // (5 ops), so the codegen per-query cost can be measured as their delta.
  // Both are cleaned and regenerated every run — reusing a stale full map
  // (e.g. after a schema or operation edit) against a fresh minus-one map
  // would silently skew the delta.
  await rm(GENERATED_DIR, { recursive: true, force: true })
  await generate(GENERATED_DIR, `${OPERATIONS_DIR}/*.graphql`)
  await rm(MINUS_ONE_OPS, { recursive: true, force: true })
  await rm(MINUS_ONE_GEN, { recursive: true, force: true })
  await mkdir(MINUS_ONE_OPS, { recursive: true })
  for (const file of readdirSync(OPERATIONS_DIR)) {
    if (file !== `${QUERY}.graphql`) {
      await copyFile(resolve(OPERATIONS_DIR, file), resolve(MINUS_ONE_OPS, file))
    }
  }
  await generate(MINUS_ONE_GEN, `${MINUS_ONE_OPS}/*.graphql`)

  console.log(`Per-query compiled size — one ${QUERY} query (11 fields, 3 levels), esbuild ESM minified\n`)
  console.log('  framework                    per-query min / gzip     runtime min / gzip')

  for (const { name, baseline, withQuery } of FRAMEWORKS) {
    const base = await bundle(baseline)
    const full = await bundle(withQuery)
    console.log(
      `  ${name.padEnd(24)}${`${full.min - base.min} B`.padStart(11)} / ${`${full.gzip - base.gzip} B`.padEnd(8)}`
      + `${`${base.min} B`.padStart(13)} / ${`${base.gzip} B`.padEnd(8)}`,
    )
  }

  await rm(MINUS_ONE_OPS, { recursive: true, force: true })
  await rm(MINUS_ONE_GEN, { recursive: true, force: true })

  console.log('\nRuntime = bundle that only references the framework. The codegen row')
  console.log('uses the 5-operation map as its baseline: the map is one constant')
  console.log('that grows linearly with every operation and cannot be tree-shaken')
  console.log('per operation.')
}

main()
