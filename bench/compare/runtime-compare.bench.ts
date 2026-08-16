/**
 * Cold DocumentNode construction: gazania builder vs graphql-tag.
 *
 * These are not part of the default bench run — opt in with:
 *
 *   BENCH_COMPARE=1 pnpm vitest bench --run bench/compare
 *
 * Each scenario produces the same printed DocumentNode on both sides. The
 * graphql-tag cache is reset before cold parses so the benchmark models the
 * startup cost paid once per distinct static operation, not request latency.
 */
import { print } from 'graphql'
import gql, { resetCaches } from 'graphql-tag'
import { bench, describe } from 'vitest'
import { gazania } from '../../src/runtime'
import { build } from '../lib/build'

const RUN = !!process.env.BENCH_COMPARE

function parseFresh(source: string) {
  resetCaches()
  return gql(source)
}

const CASES = [
  {
    name: 'simple flat query',
    gazania: () => gazania.query('GetUsers')
      .select($ => $.select([{
        users: $ => $.select(['id', 'name', 'email']),
      }])),
    source: `
      query GetUsers {
        users { id name email }
      }`,
  },
  {
    name: 'query with variables and args',
    gazania: () => gazania.query('GetUser')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          'id',
          'name',
          { sayings: $ => $.select(['id', 'content']) },
        ]),
      }])),
    source: `
      query GetUser($id: Int!) {
        user(id: $id) {
          id
          name
          sayings { id content }
        }
      }`,
  },
  {
    name: 'nested two levels',
    gazania: () => gazania.query('GetUserDeep')
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
      }])),
    source: `
      query GetUserDeep($id: Int!) {
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
      }`,
  },
  {
    name: 'union inline fragments',
    gazania: () => gazania.query('GetAll')
      .select($ => $.select([{
        all: $ => $.select([
          '__typename',
          {
            '... on Saying': $ => $.select(['id', 'content', 'category']),
            '... on User': $ => $.select(['id', 'name', 'email']),
          },
        ]),
      }])),
    source: `
      query GetAll {
        all {
          __typename
          ... on Saying { id content category }
          ... on User { id name email }
        }
      }`,
  },
  {
    name: 'complex mixed query',
    gazania: () => gazania.query('Complex')
      .vars({ userId: 'Int!', category: 'CategoryEnum' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.userId }).select([
          '__typename',
          {
            sayings: $ => $.args({ category: vars.category }).select([
              'id',
              'content',
              { owner: $ => $.select(['id', 'name']) },
            ]),
            friends: $ => $.select(['id', 'name']),
          },
        ]),
        all: $ => $.select([
          '__typename',
          {
            '... on Saying': $ => $.select(['id', 'content']),
            '... on User': $ => $.select(['id', 'name']),
          },
        ]),
      }])),
    source: `
      query Complex($userId: Int!, $category: CategoryEnum) {
        user(id: $userId) {
          __typename
          sayings(category: $category) {
            id
            content
            owner { id name }
          }
          friends { id name }
        }
        all {
          __typename
          ... on Saying { id content }
          ... on User { id name }
        }
      }`,
  },
] as const

if (RUN) {
  // Fail before benchmarking if a supposedly equivalent pair drifts apart.
  for (const { name, gazania: createGazania, source } of CASES) {
    const actual = print(build(createGazania()))
    const expected = print(parseFresh(source))
    if (actual !== expected) {
      throw new Error(`runtime comparison case "${name}" does not produce the same DocumentNode`)
    }
  }
  resetCaches()
}

describe.skipIf(!RUN)('compare – cold DocumentNode construction', () => {
  for (const { name, gazania: createGazania, source } of CASES) {
    bench(`gazania – ${name}`, () => {
      build(createGazania())
    })

    bench(`graphql-tag (cache empty) – ${name}`, () => {
      parseFresh(source)
    })
  }
})

const STARTUP_DEFINITIONS = 100
const startupCase = CASES[2]

function parseStartupBatch(duplicateRatio: number) {
  resetCaches()
  const uniqueCount = Math.max(1, STARTUP_DEFINITIONS * (1 - duplicateRatio))
  for (let index = 0; index < STARTUP_DEFINITIONS; index++) {
    const definition = index % uniqueCount
    gql(`${startupCase.source}\n# definition-${definition}`)
  }
}

describe.skipIf(!RUN)('compare – startup cache model (100 definitions)', () => {
  bench('gazania – build 100 documents', () => {
    for (let index = 0; index < STARTUP_DEFINITIONS; index++) {
      build(startupCase.gazania())
    }
  })

  for (const duplicateRatio of [0, 0.25, 0.5, 0.75] as const) {
    bench(`graphql-tag – ${duplicateRatio * 100}% duplicate definitions`, () => {
      parseStartupBatch(duplicateRatio)
    })
  }
})
