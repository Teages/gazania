/**
 * Production bundle comparison for paths that deliver a DocumentNode in the
 * browser. Reports total bundles across an operation-count curve so fixed runtime
 * cost and per-operation AST cost are visible without subtracting unrelated
 * baselines.
 *
 *   node bench/compare/size-compare.mjs
 */
/* eslint-disable no-console */
import { Buffer } from 'node:buffer'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { executeCodegen } from '@graphql-codegen/cli'
import esbuild from 'esbuild'
import { parse, print } from 'graphql'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OPERATIONS_DIR = resolve(__dirname, 'operations')
const GENERATED_DIR = resolve(__dirname, '.generated')
const TEMP_OPERATIONS_DIR = resolve(__dirname, '.tmp-operations')

const BASE_QUERY_NAME = 'GetUserDeep'
const BASE_QUERY_FILE = resolve(OPERATIONS_DIR, `${BASE_QUERY_NAME}.graphql`)

function gazaniaBuilder(name) {
  return `gazania.query('${name}')
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
      }]))`
}

function createOperations(source, count) {
  return Array.from({ length: count }, (_, index) => {
    const name = index === 0 ? BASE_QUERY_NAME : `${BASE_QUERY_NAME}${index + 1}`
    return {
      name,
      exportName: `${name}Document`,
      builder: gazaniaBuilder(name),
      source: source.replace(`query ${BASE_QUERY_NAME}`, `query ${name}`),
    }
  })
}

async function generateDocuments(operations) {
  await rm(GENERATED_DIR, { recursive: true, force: true })
  await rm(TEMP_OPERATIONS_DIR, { recursive: true, force: true })
  await mkdir(TEMP_OPERATIONS_DIR, { recursive: true })
  for (const operation of operations) {
    await writeFile(resolve(TEMP_OPERATIONS_DIR, `${operation.name}.graphql`), operation.source, 'utf8')
  }
  const output = await executeCodegen({
    schema: resolve(__dirname, 'schema.graphql'),
    documents: resolve(TEMP_OPERATIONS_DIR, '*.graphql'),
    generates: { [`${GENERATED_DIR}/`]: { preset: 'client', plugins: [] } },
  })
  for (const file of output.result) {
    await mkdir(dirname(file.filename), { recursive: true })
    await writeFile(file.filename, file.content, 'utf8')
  }
}

function gazaniaEntry(operations) {
  return `
    import { gazania } from '../../src/runtime'
    export default [${operations.map(operation => operation.builder).join(',\n')}]
  `
}

function graphqlTagEntry(operations) {
  return `
    import gql from 'graphql-tag'
    export default [${operations.map(operation => `gql(${JSON.stringify(operation.source)})`).join(',\n')}]
  `
}

function defaultCodegenEntry(operations) {
  return `
    import { graphql } from './.generated/gql'
    export default [${operations.map(operation => `graphql(${JSON.stringify(print(parse(operation.source)))})`).join(',\n')}]
  `
}

function directDocumentEntry(operations) {
  const names = operations.map(operation => operation.exportName)
  return `
    import { ${names.join(', ')} } from './.generated/graphql'
    export default [${names.join(', ')}]
  `
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
  const code = Buffer.from(result.outputFiles[0].text)
  return { min: code.length, gzip: gzipSync(code).length }
}

function formatSize(size) {
  return `${size.min} B / ${size.gzip} B`
}

async function main() {
  const source = await readFile(BASE_QUERY_FILE, 'utf8')
  const counts = [1, 10, 50]
  const strategies = [
    { name: 'gazania (compact builder -> AST)', entry: gazaniaEntry },
    { name: 'graphql-tag (source + parser)', entry: graphqlTagEntry },
    { name: 'client-preset (default map)', entry: defaultCodegenEntry },
    { name: 'client-preset (direct AST import)', entry: directDocumentEntry },
  ]
  const results = new Map(strategies.map(strategy => [strategy.name, []]))

  for (const count of counts) {
    const operations = createOperations(source, count)
    // Regenerate for every project size so the default map contains exactly
    // the same operations as the other strategies.
    await generateDocuments(operations)
    for (const strategy of strategies) {
      results.get(strategy.name).push(await bundle(strategy.entry(operations)))
    }
  }

  console.log('Total browser bundle size (esbuild ESM minified, min / gzip)\n')
  console.log(`  ${'strategy'.padEnd(38)}${counts.map(count => `${count} operation${count === 1 ? '' : 's'}`.padStart(22)).join('')}`)

  for (const strategy of strategies) {
    console.log(
      `  ${strategy.name.padEnd(38)}${results.get(strategy.name).map(size => formatSize(size).padStart(22)).join('')}`,
    )
  }

  await rm(TEMP_OPERATIONS_DIR, { recursive: true, force: true })

  console.log('\nAll rows deliver a DocumentNode in the browser. The direct-import row')
  console.log('represents client-preset with its optimizer rewriting calls to direct imports;')
  console.log('tree shaking removes unused documents, but every used AST remains.')
  console.log('String-only document modes are excluded because they do not deliver an AST.')
}

main()
