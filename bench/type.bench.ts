/**
 * Type-checking performance benchmarks.
 *
 * Each bench case creates a fresh TypeScript program from an in-memory source
 * snippet and measures `getSemanticDiagnostics()` – the full type-inference
 * pass – for progressively more complex gazania selections.
 *
 * These benchmarks are intentionally slower than the runtime ones (a full
 * TypeScript compiler invocation per iteration). Use them to establish
 * baselines before and after changes to the type definitions.
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bench, describe, expect } from 'vitest'
import { createTypeCheck, formatTypeErrors } from './lib/typecheck'

const __dirname = dirname(fileURLToPath(import.meta.url))

// The virtual file is placed inside bench/ so that relative imports resolve
// against the real project layout:  '../src/...' → 'src/...'
const typeCheck = createTypeCheck(resolve(__dirname, '_virtual_type_bench_.ts'))

// Imports that every scenario needs.
const IMPORTS = `
import type { TypedGazania } from '../src/index'
import type { ResultOf } from '../src/types/document'
import type { Schema } from '../test/types/schema'
declare const g: TypedGazania<Schema>
`

// ─── Benchmark scenarios ──────────────────────────────────────────────────────

const SCENARIOS = {
  'simple – single scalar field': `
    ${IMPORTS}
    const _doc = g.query('Hello').select($ => $.select(['hello']))
  `,

  'flat – multiple scalar fields': `
    ${IMPORTS}
    const _doc = g.query('GetUsers').select($ => $.select([{
      users: $ => $.select(['id', 'name', 'email']),
    }]))
  `,

  'nested – one level deep': `
    ${IMPORTS}
    const _doc = g.query('GetUser')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          'id',
          'name',
          { sayings: $ => $.select(['id', 'content']) },
        ]),
      }]))
  `,

  'nested – two levels deep': `
    ${IMPORTS}
    const _doc = g.query('GetUserDeep')
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
  `,

  'nested – four levels deep': `
    ${IMPORTS}
    const _doc = g.query('Deep').select($ => $.select([{
      user: $ => $.select([{
        sayings: $ => $.select([{
          owner: $ => $.select([{
            friends: $ => $.select(['id', 'name']),
          }]),
        }]),
      }]),
    }]))
  `,

  'wide – 11 fields on two branches': `
    ${IMPORTS}
    const _doc = g.query('Wide').select($ => $.select([{
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
    }]))
  `,

  'union – inline fragments': `
    ${IMPORTS}
    const _doc = g.query('GetAll').select($ => $.select([{
      all: $ => $.select([
        '__typename',
        {
          '... on Saying': $ => $.select(['id', 'content', 'category']),
          '... on User': $ => $.select(['id', 'name', 'email']),
        },
      ]),
    }]))
  `,

  'interface – inline fragment': `
    ${IMPORTS}
    const _doc = g.query('GetAllIds').select($ => $.select([{
      allId: $ => $.select([
        '__typename',
        'id',
        { '... on Saying': $ => $.select(['content']) },
      ]),
    }]))
  `,

  'partial – define and spread': `
    ${IMPORTS}
    const sayingFields = g.partial('SayingFields').on('Saying').select($ =>
      $.select(['id', 'content', 'category', 'createdAt'])
    )
    const _doc = g.query('GetSayings').select($ => $.select([{
      sayings: $ => $.select([...sayingFields({})]),
    }]))
  `,

  'fragment – standalone typed fragment': `
    ${IMPORTS}
    const _frag = g.fragment('UserFields').on('User').select($ =>
      $.select(['id', 'name', 'email'])
    )
  `,

  'complex – mixed fields, args, inline fragments, partial': `
    ${IMPORTS}
    const userFields = g.partial('UserFields').on('User').select($ =>
      $.select(['id', 'name', 'email'])
    )
    const _doc = g.query('Complex')
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
                'category',
                {
                  owner: $ => $.select(['id', 'name']),
                },
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
        },
      ]))
  `,

  'result type – flat data extraction': `
    ${IMPORTS}
    const doc = g.query('GetUsers').select($ => $.select([{
      users: $ => $.select(['id', 'name', 'email']),
    }]))
    declare const data: ResultOf<typeof doc>
    const _name: string = data.users[0].name
  `,

  'result type – union data extraction': `
    ${IMPORTS}
    const doc = g.query('GetAll').select($ => $.select([{
      all: $ => $.select([
        '__typename',
        {
          '... on Saying': $ => $.select(['id', 'content', { owner: $ => $.select(['name']) }]),
          '... on User': $ => $.select(['id', 'name']),
        },
      ]),
    }]))
    declare const data: ResultOf<typeof doc>
    const _id: number = data.all[0].id
  `,
} as const

// ─── Fixture validation ───────────────────────────────────────────────────────

// A scenario with type errors still gets measured by `bench` (yielding a NaN
// mean and a passing exit code — `beforeAll` failures are swallowed too), so
// every fixture is verified once at module load to fail loudly instead.
for (const [name, code] of Object.entries(SCENARIOS)) {
  const { diagnostics } = typeCheck(code)
  if (diagnostics.length > 0) {
    throw new Error(formatTypeErrors(name, diagnostics))
  }
}

// ─── Vitest bench suite ───────────────────────────────────────────────────────

describe('type check', () => {
  for (const [name, code] of Object.entries(SCENARIOS)) {
    bench(
      name,
      () => {
        const result = typeCheck(code)
        // Ensure the code type-checks without errors (catches benchmark
        // fixture bugs rather than silently measuring broken scenarios).
        expect(result.diagnostics.length, `unexpected type errors in "${name}"`).toBe(0)
      },
      // TypeScript compiler runs are expensive: keep iteration count small
      // while still providing meaningful comparative data.
      { iterations: 3, warmupIterations: 1 },
    )
  }
})
