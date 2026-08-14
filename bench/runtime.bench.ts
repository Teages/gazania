import type { DocumentNode } from '../src/lib/graphql'
import { print } from 'graphql'
import { bench, describe } from 'vitest'
import { gazania } from '../src/runtime'
import { createFragmentBuilder } from '../src/runtime/builder/fragment'
import { createOperationBuilder } from '../src/runtime/builder/operation'
import { createPartialBuilder } from '../src/runtime/builder/partial'

/**
 * `.select()` returns a lazy DocumentNode: the callback runs and the selection
 * AST is built only on first `.definitions` access. Every bench case must
 * materialize the document, otherwise it measures closure creation instead of
 * the actual operation analysis.
 */
function build(doc: DocumentNode): DocumentNode {
  void doc.definitions
  return doc
}

// ─── Operation builder ────────────────────────────────────────────────────────

describe('operation builder', () => {
  bench('simple query – single scalar field', () => {
    build(createOperationBuilder('query', 'Hello')
      .select($ => $.select(['hello'])))
  })

  bench('query – flat scalar fields', () => {
    build(createOperationBuilder('query', 'GetUsers')
      .select($ => $.select([{
        users: $ => $.select(['id', 'name', 'email']),
      }])))
  })

  bench('query with variables and args', () => {
    build(createOperationBuilder('query', 'GetUser')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select(['id', 'name', 'email']),
      }])))
  })

  bench('query – nested one level', () => {
    build(createOperationBuilder('query', 'GetUserSayings')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          'id',
          'name',
          { sayings: $ => $.select(['id', 'content']) },
        ]),
      }])))
  })

  bench('query – nested two levels', () => {
    build(createOperationBuilder('query', 'GetUserDeep')
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

  bench('query – nested four levels', () => {
    build(createOperationBuilder('query', 'Deep')
      .select($ => $.select([{
        user: $ => $.select([{
          sayings: $ => $.select([{
            owner: $ => $.select([{
              friends: $ => $.select(['id', 'name']),
            }]),
          }]),
        }]),
      }])))
  })

  bench('query – wide, 11 fields on two branches', () => {
    build(createOperationBuilder('query', 'Wide')
      .select($ => $.select([{
        users: $ => $.select([
          'id',
          'name',
          'email',
          {
            friends: $ => $.select(['id']),
            sayings: $ => $.select(['id']),
          },
        ]),
        sayings: $ => $.select(['id', 'content', 'category', 'createdAt', 'updatedAt']),
      }])))
  })

  bench('query – union inline fragments', () => {
    build(createOperationBuilder('query', 'GetAll')
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

  bench('query – interface inline fragment', () => {
    build(createOperationBuilder('query', 'GetAllIds')
      .select($ => $.select([{
        allId: $ => $.select([
          '__typename',
          'id',
          { '... on Saying': $ => $.select(['content']) },
        ]),
      }])))
  })

  bench('query – field aliases', () => {
    build(createOperationBuilder('query', 'Aliased')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        'myUser: user': $ => $.args({ id: vars.id }).select(['id', 'myName: name']),
      }])))
  })

  bench('query with operation and field directives', () => {
    build(createOperationBuilder('query', 'GetConditional')
      .vars({ withEmail: 'Boolean!' })
      .directives(() => [['@cached', { ttl: 60 }]])
      .select(($, vars) => $.select([
        { user: $ => $.args({ id: 1 }).select(['id']) },
        {
          hello: $ => $.directives(['@include', { if: vars.withEmail }]),
        },
      ])))
  })

  bench('mutation with input object args', () => {
    build(createOperationBuilder('mutation', 'AddSaying')
      .vars({ ownerId: 'Int!' })
      .select(($, vars) => $.select([{
        addSaying: $ => $.args({
          input: { content: 'hello', category: 'funny' },
          ownerId: vars.ownerId,
        }).select(['id', 'content', 'createdAt']),
      }])))
  })

  bench('subscription with args', () => {
    build(createOperationBuilder('subscription', 'OnCountdown')
      .vars({ from: 'Int!' })
      .select(($, vars) => $.select([{
        countdown: $ => $.args({ from: vars.from }),
      }])))
  })
})

// ─── Fragment builder ─────────────────────────────────────────────────────────

describe('fragment builder', () => {
  bench('simple fragment', () => {
    build(createFragmentBuilder('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name', 'email'])))
  })

  bench('fragment with variables', () => {
    build(createFragmentBuilder('UserFields')
      .on('User')
      .vars({ withEmail: 'Boolean!' })
      .select(($, vars) => $.select([
        'id',
        'name',
        {
          email: $ => $.directives(['@include', { if: vars.withEmail }]),
        },
      ])))
  })

  bench('fragment with directives', () => {
    build(createFragmentBuilder('UserFields')
      .on('User')
      .directives(() => [['@deprecated', { reason: 'use NewFields' }]])
      .select($ => $.select(['id', 'name'])))
  })
})

// ─── Partial builder ──────────────────────────────────────────────────────────

describe('partial builder', () => {
  // Defining a partial only wires up a lazy fragment document; the fragment
  // itself is built when the partial is spread into an operation (see below).
  bench('define partial package', () => {
    createPartialBuilder('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name', 'email']))
  })

  bench('spread partial into query', () => {
    const userFields = createPartialBuilder('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name', 'email']))

    build(createOperationBuilder('query', 'GetUser')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          ...userFields(vars),
          '__typename',
        ]),
      }])))
  })
})

// ─── Gazania facade ───────────────────────────────────────────────────────────

describe('gazania facade', () => {
  bench('query via gazania facade', () => {
    build(gazania.query('GetUser')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select(['id', 'name']),
      }])))
  })

  bench('mutation with enum arg via gazania.enum', () => {
    build(gazania.mutation('AddSaying')
      .vars({ ownerId: 'Int!' })
      .select(($, vars) => $.select([{
        addSaying: $ => $.args({
          input: { content: 'hello', category: gazania.enum('funny') },
          ownerId: vars.ownerId,
        }).select(['id']),
      }])))
  })

  bench('fragment via gazania facade', () => {
    build(gazania.fragment('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name'])))
  })

  bench('partial via gazania facade', () => {
    gazania.partial('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name']))
  })

  bench('section via gazania facade', () => {
    gazania.section('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name']))
  })
})

// ─── Serialization ────────────────────────────────────────────────────────────

describe('serialization', () => {
  const simpleDoc = () => gazania.query('GetUsers')
    .select($ => $.select([{ users: $ => $.select(['id', 'name', 'email']) }]))

  const userFields = gazania.partial('UserFields')
    .on('User')
    .vars({ withEmail: 'Boolean!' })
    .select(($, vars) => $.select([
      'id',
      'name',
      { email: $ => $.directives(['@include', { if: vars.withEmail }]) },
    ]))

  const complexDoc = () => gazania.query('Complex')
    .vars({ userId: 'Int!', category: 'CategoryEnum' })
    .select(($, vars) => $.select([
      {
        user: $ => $.args({ id: vars.userId }).select([
          ...userFields(vars),
          '__typename',
          {
            sayings: $ => $.args({ category: vars.category }).select([
              'id',
              'content',
              { owner: $ => $.select(['id', 'name']) },
            ]),
          },
        ]),
      },
      {
        all: $ => $.select([
          '__typename',
          {
            '... on Saying': $ => $.select(['id', 'content']),
            '... on User': $ => $.select(['id', 'name']),
          },
        ]),
      },
    ]))

  bench('print – simple query', () => {
    print(simpleDoc())
  })

  bench('build + print – complex query end-to-end', () => {
    print(complexDoc())
  })
})
