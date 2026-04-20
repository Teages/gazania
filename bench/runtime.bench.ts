import { bench, describe } from 'vitest'
import { gazania } from '../src/runtime'
import { createOperationBuilder } from '../src/runtime/builder/operation'
import { createFragmentBuilder } from '../src/runtime/builder/fragment'
import { createPartialBuilder } from '../src/runtime/builder/partial'

// ─── Operation builder ────────────────────────────────────────────────────────

describe('operation builder', () => {
  bench('simple query – flat string fields', () => {
    createOperationBuilder('query', 'GetUser')
      .select($ => $.select(['id', 'name', 'email']))
  })

  bench('query with variables and args', () => {
    createOperationBuilder('query', 'GetUser')
      .vars({ id: 'ID!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select(['id', 'name', 'email']),
      }]))
  })

  bench('query with nested selections', () => {
    createOperationBuilder('query', 'GetUserWithFriends')
      .vars({ id: 'ID!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          'id',
          'name',
          {
            friends: $ => $.select(['id', 'name']),
          },
        ]),
      }]))
  })

  bench('query with inline fragments', () => {
    createOperationBuilder('query', 'GetFeed')
      .select($ => $.select([{
        feed: $ => $.select([
          '__typename',
          {
            '... on Post': $ => $.select(['title', 'body']),
            '... on Image': $ => $.select(['url', 'alt']),
          },
        ]),
      }]))
  })

  bench('query with directives', () => {
    createOperationBuilder('query', 'GetConditional')
      .vars({ withEmail: 'Boolean!' })
      .directives(() => [['@cached', { ttl: 60 }]])
      .select(($, vars) => $.select([
        'id',
        {
          email: $ => $.directives(['@include', { if: vars.withEmail }]),
        },
      ]))
  })

  bench('mutation with input args', () => {
    createOperationBuilder('mutation', 'CreatePost')
      .vars({ title: 'String!', body: 'String!', authorId: 'ID!' })
      .select(($, vars) => $.select([{
        createPost: $ => $.args({
          title: vars.title,
          body: vars.body,
          authorId: vars.authorId,
        }).select(['id', 'title', 'createdAt']),
      }]))
  })

  bench('deeply nested query (4 levels)', () => {
    createOperationBuilder('query', 'Deep')
      .select($ => $.select([{
        org: $ => $.select([{
          team: $ => $.select([{
            member: $ => $.select([{
              profile: $ => $.select(['id', 'name', 'bio']),
            }]),
          }]),
        }]),
      }]))
  })

  bench('query with many fields (10)', () => {
    createOperationBuilder('query', 'GetProfile')
      .select($ => $.select([{
        user: $ => $.select([
          'id',
          'name',
          'email',
          'avatarUrl',
          'bio',
          'location',
          'website',
          'createdAt',
          'updatedAt',
          'isVerified',
        ]),
      }]))
  })
})

// ─── Fragment builder ─────────────────────────────────────────────────────────

describe('fragment builder', () => {
  bench('simple fragment', () => {
    createFragmentBuilder('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name', 'email']))
  })

  bench('fragment with variables', () => {
    createFragmentBuilder('UserFields')
      .on('User')
      .vars({ withEmail: 'Boolean!' })
      .select(($, vars) => $.select([
        'id',
        'name',
        {
          email: $ => $.directives(['@include', { if: vars.withEmail }]),
        },
      ]))
  })

  bench('fragment with directives', () => {
    createFragmentBuilder('UserFields')
      .on('User')
      .directives(() => [['@deprecated', { reason: 'use NewFields' }]])
      .select($ => $.select(['id', 'name']))
  })
})

// ─── Partial builder ──────────────────────────────────────────────────────────

describe('partial builder', () => {
  bench('create partial package', () => {
    createPartialBuilder('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name', 'email']))
  })

  bench('spread partial into query', () => {
    const userFields = createPartialBuilder('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name', 'email']))

    createOperationBuilder('query', 'GetUser')
      .vars({ id: 'ID!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          ...userFields(vars),
          '__typename',
        ]),
      }]))
  })
})

// ─── Gazania facade ───────────────────────────────────────────────────────────

describe('gazania facade', () => {
  bench('query via gazania facade', () => {
    gazania.query('GetUser')
      .vars({ id: 'ID!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select(['id', 'name']),
      }]))
  })

  bench('fragment via gazania facade', () => {
    gazania.fragment('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name']))
  })

  bench('partial via gazania facade', () => {
    gazania.partial('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name']))
  })
})
