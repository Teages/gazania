/**
 * Framework comparison benchmarks (compile time): gazania inline type
 * inference vs @graphql-codegen/client-preset generated types.
 *
 * These are not part of the default bench run — opt in with:
 *
 *   BENCH_COMPARE=1 pnpm vitest bench --run bench/compare
 *
 * The comparison measures three things:
 * 1. The codegen build step itself (which gazania does not need).
 * 2. Type-checking query usage against generated documents (string-literal
 *    overload resolution over the generated `graphql()` function).
 * 3. The same query usage written with the gazania builder.
 *
 * Codegen usage must match the generated document keys exactly (the printed
 * form of each operation); a mismatch falls through to the
 * `graphql(source: string): unknown` overload, which the result-type access
 * in every scenario turns into a loud fixture error.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { executeCodegen } from '@graphql-codegen/cli'
import { bench, describe, expect } from 'vitest'
import { createTypeCheck, formatTypeErrors } from '../lib/typecheck'

const RUN = !!process.env.BENCH_COMPARE

const __dirname = dirname(fileURLToPath(import.meta.url))
const GENERATED_DIR = resolve(__dirname, '.generated')

async function runCodegen() {
  const output = await executeCodegen({
    schema: resolve(__dirname, 'schema.graphql'),
    documents: resolve(__dirname, 'operations/*.graphql'),
    generates: {
      [`${GENERATED_DIR}/`]: { preset: 'client', plugins: [] },
    },
  })
  for (const file of output.result) {
    await mkdir(dirname(file.filename), { recursive: true })
    await writeFile(file.filename, file.content, 'utf8')
  }
  return output.result.length
}

// Generate the typed documents before any bench case or fixture validation
// touches them; the same call is measured by the "generation" bench case.
if (RUN) {
  await runCodegen()
}

const typeCheck = createTypeCheck(resolve(__dirname, '_virtual_type_compare_.ts'))

const IMPORTS = `
import type { TypedGazania } from '../../src/index'
import type { ResultOf } from '../../src/types/document'
import type { Schema } from '../../test/types/schema'
import { graphql } from './.generated/gql'
declare const g: TypedGazania<Schema>
`

/** Same operation expressed with the gazania builder and with codegen documents. */
const SCENARIOS: Record<string, { gazania: string, codegen: string }> = {
  'simple query': {
    gazania: `
      const doc = g.query('Hello').select($ => $.select(['hello']))
      declare const data: ResultOf<typeof doc>
      const _hello = data.hello
    `,
    codegen: `
      const doc = graphql(\`query Hello {
  hello
}\`)
      declare const data: ResultOf<typeof doc>
      const _hello = data.hello
    `,
  },

  'flat fields': {
    gazania: `
      const doc = g.query('GetUsers').select($ => $.select([{
        users: $ => $.select(['id', 'name', 'email']),
      }]))
      declare const data: ResultOf<typeof doc>
      const _name = data.users[0].name
    `,
    codegen: `
      const doc = graphql(\`query GetUsers {
  users {
    id
    name
    email
  }
}\`)
      declare const data: ResultOf<typeof doc>
      const _name = data.users[0].name
    `,
  },

  'vars and args': {
    gazania: `
      const doc = g.query('GetUser')
        .vars({ id: 'Int!' })
        .select(($, vars) => $.select([{
          user: $ => $.args({ id: vars.id }).select([
            'id',
            'name',
            { sayings: $ => $.select(['id', 'content']) },
          ]),
        }]))
      declare const data: ResultOf<typeof doc>
      const _content = data.user?.sayings[0]?.content
    `,
    codegen: `
      const doc = graphql(\`query GetUser($id: Int!) {
  user(id: $id) {
    id
    name
    sayings {
      id
      content
    }
  }
}\`)
      declare const data: ResultOf<typeof doc>
      const _content = data.user?.sayings[0]?.content
    `,
  },

  'nested deep': {
    gazania: `
      const doc = g.query('GetUserDeep')
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
      declare const data: ResultOf<typeof doc>
      const _email = data.user?.sayings[0]?.owner.email
    `,
    codegen: `
      const doc = graphql(\`query GetUserDeep($id: Int!) {
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
      declare const data: ResultOf<typeof doc>
      const _email = data.user?.sayings[0]?.owner.email
    `,
  },

  'union inline fragments': {
    gazania: `
      const doc = g.query('GetAll').select($ => $.select([{
        all: $ => $.select([
          '__typename',
          {
            '... on Saying': $ => $.select(['id', 'content', 'category']),
            '... on User': $ => $.select(['id', 'name', 'email']),
          },
        ]),
      }]))
      declare const data: ResultOf<typeof doc>
      const _content = data.all[0]
    `,
    codegen: `
      const doc = graphql(\`query GetAll {
  all {
    __typename
    ... on Saying {
      id
      content
      category
    }
    ... on User {
      id
      name
      email
    }
  }
}\`)
      declare const data: ResultOf<typeof doc>
      const _content = data.all[0]
    `,
  },

  'mutation with input': {
    gazania: `
      const doc = g.mutation('AddSaying')
        .vars({ ownerId: 'Int!' })
        .select(($, vars) => $.select([{
          addSaying: $ => $.args({
            input: { content: 'hello', category: g.enum('funny') },
            ownerId: vars.ownerId,
          }).select(['id', 'content', 'createdAt']),
        }]))
      declare const data: ResultOf<typeof doc>
      const _id = data.addSaying?.id
    `,
    codegen: `
      const doc = graphql(\`mutation AddSaying($ownerId: Int!) {
  addSaying(input: {content: "hello", category: funny}, ownerId: $ownerId) {
    id
    content
    createdAt
  }
}\`)
      declare const data: ResultOf<typeof doc>
      const _id = data.addSaying?.id
    `,
  },
}

if (RUN) {
  for (const [name, sources] of Object.entries(SCENARIOS)) {
    for (const style of ['gazania', 'codegen'] as const) {
      const { diagnostics } = typeCheck(`${IMPORTS}${sources[style]}`)
      if (diagnostics.length > 0) {
        throw new Error(formatTypeErrors(`${name} (${style})`, diagnostics))
      }
    }
  }
}

// TypeScript compiler runs are expensive: keep iteration count small while
// still providing meaningful comparative data.
const TYPE_BENCH_OPTIONS = { iterations: 3, warmupIterations: 1 } as const

describe.skipIf(!RUN)('compare – type: gazania vs graphql codegen', () => {
  bench('codegen – client preset generation', async () => {
    const files = await runCodegen()
    expect(files).toBeGreaterThan(0)
  }, { iterations: 2, warmupIterations: 1 })

  for (const [name, { gazania, codegen }] of Object.entries(SCENARIOS)) {
    bench(`gazania – typecheck: ${name}`, () => {
      const result = typeCheck(`${IMPORTS}${gazania}`)
      expect(result.diagnostics.length).toBe(0)
    }, TYPE_BENCH_OPTIONS)

    bench(`codegen – typecheck: ${name}`, () => {
      const result = typeCheck(`${IMPORTS}${codegen}`)
      expect(result.diagnostics.length).toBe(0)
    }, TYPE_BENCH_OPTIONS)
  }
})
