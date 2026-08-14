import { print } from 'graphql'
/**
 * Framework comparison benchmarks (runtime): gazania builder vs graphql-tag.
 *
 * These are not part of the default bench run — opt in with:
 *
 *   BENCH_COMPARE=1 pnpm vitest bench --run bench/compare
 *
 * Each scenario is expressed once as a gazania builder chain (built and
 * materialized) and once as the equivalent GraphQL source string parsed by
 * graphql-tag, so both sides produce a DocumentNode for the same operation.
 */
import gql from 'graphql-tag'
import { bench, describe } from 'vitest'
import { gazania } from '../../src/runtime'
import { build } from '../lib/build'

const RUN = !!process.env.BENCH_COMPARE

let parseCounter = 0
/**
 * graphql-tag caches parsed documents keyed by source string, so a repeated
 * call measures the cache instead of the parser. A unique trailing comment
 * forces a fresh parse on every call.
 */
function parseFresh(source: string) {
  return gql(`${source}\n#bench-${++parseCounter}`)
}

describe.skipIf(!RUN)('compare – runtime: gazania vs graphql-tag', () => {
  bench('gazania – simple flat query', () => {
    build(gazania.query('GetUsers')
      .select($ => $.select([{
        users: $ => $.select(['id', 'name', 'email']),
      }])))
  })

  bench('graphql-tag – simple flat query', () => {
    parseFresh(`
      query GetUsers {
        users { id name email }
      }`)
  })

  bench('gazania – query with variables and args', () => {
    build(gazania.query('GetUser')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          'id',
          'name',
          { sayings: $ => $.select(['id', 'content']) },
        ]),
      }])))
  })

  bench('graphql-tag – query with variables and args', () => {
    parseFresh(`
      query GetUser($id: Int!) {
        user(id: $id) {
          id
          name
          sayings { id content }
        }
      }`)
  })

  bench('gazania – nested two levels', () => {
    build(gazania.query('GetUserDeep')
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
      }])))
  })

  bench('graphql-tag – nested two levels', () => {
    parseFresh(`
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
      }`)
  })

  bench('gazania – union inline fragments', () => {
    build(gazania.query('GetAll')
      .select($ => $.select([{
        all: $ => $.select([
          '__typename',
          {
            '... on Saying': $ => $.select(['id', 'content', 'category']),
            '... on User': $ => $.select(['id', 'name', 'email']),
          },
        ]),
      }])))
  })

  bench('graphql-tag – union inline fragments', () => {
    parseFresh(`
      query GetAll {
        all {
          __typename
          ... on Saying { id content category }
          ... on User { id name email }
        }
      }`)
  })

  bench('gazania – complex mixed query', () => {
    build(gazania.query('Complex')
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
      }])))
  })

  bench('graphql-tag – complex mixed query', () => {
    parseFresh(`
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
      }`)
  })

  bench('gazania – build + print complex query', () => {
    print(build(gazania.query('Complex')
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
          },
        ]),
      }]))))
  })

  bench('graphql-tag – parse + print complex query', () => {
    print(parseFresh(`
      query Complex($userId: Int!, $category: CategoryEnum) {
        user(id: $userId) {
          __typename
          sayings(category: $category) {
            id
            content
            owner { id name }
          }
        }
      }`))
  })
})
