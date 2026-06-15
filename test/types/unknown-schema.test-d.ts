import type {
  ObjectFieldDollar,
  PrepareSelection,
  ResultOf,
  RootDollar,
  ScalarFieldDollar,
  TypedScalarSelection,
  TypedSelectionSet,
  VariablesOf,
} from '../../src'
import { describe, expectTypeOf, test } from 'vitest'
import { createGazania } from '../../src'

describe('unknown schema selection result inference', () => {
  test('createGazania() yields a typed-unknown selection builder', () => {
    const g = createGazania()
    const _doc = g.query().select($ => $.select([
      'a',
      { b: $ => $.select(['c']) },
    ]))

    expectTypeOf<ResultOf<typeof _doc>>().toEqualTypeOf<{
      a: unknown
      b: { c: unknown }
    }>()
    expectTypeOf<VariablesOf<typeof _doc>>().toEqualTypeOf<Record<string, never>>()
  })

  test('alias: "x: a" -> { x: unknown }', () => {
    const g = createGazania()
    const _doc = g.query().select($ => $.select([
      'x: a',
      'b',
    ]))

    expectTypeOf<ResultOf<typeof _doc>>().toEqualTypeOf<{
      x: unknown
      b: unknown
    }>()
  })

  test('nested alias: { "y: b": $ => $.select(["c"]) } -> { y: { c: unknown } }', () => {
    const g = createGazania()
    const _doc = g.query().select($ => $.select([
      'a',
      {
        'y: b': $ => $.select([
          'c',
          { d: $ => $.select(['e']) },
        ]),
      },
    ]))

    expectTypeOf<ResultOf<typeof _doc>>().toEqualTypeOf<{
      a: unknown
      y: {
        c: unknown
        d: { e: unknown }
      }
    }>()
  })

  test('mutation and subscription return same typed-unknown builder', () => {
    const g = createGazania()
    const _mut = g.mutation().select($ => $.select(['id']))
    const _sub = g.subscription().select($ => $.select(['id']))

    expectTypeOf<ResultOf<typeof _mut>>().toEqualTypeOf<{ id: unknown }>()
    expectTypeOf<ResultOf<typeof _sub>>().toEqualTypeOf<{ id: unknown }>()
  })

  test('vars chain still produces typed-unknown result with variables', () => {
    const g = createGazania()
    const _doc = g.query()
      .vars({ id: 'ID!' })
      .select(($, _vars) => $.select([
        'a',
        { b: $ => $.select(['c']) },
      ]))

    expectTypeOf<ResultOf<typeof _doc>>().toEqualTypeOf<{
      a: unknown
      b: { c: unknown }
    }>()
  })

  test('vars definitions resolve to unknown values, never `never`', () => {
    const g = createGazania()
    const _doc = g.query()
      .vars({ id: 'ID!', optional: 'String', defaulted: 'Int = 0' })
      .select($ => $.select(['node']))

    type Vars = VariablesOf<typeof _doc>
    // Core guarantee from the unknown-schema contract: with no type registry,
    // variable values must be `unknown` (accept any value at runtime) — NOT
    // `never`, which would forbid every value.
    expectTypeOf<Vars['id']>().toEqualTypeOf<unknown>()
    expectTypeOf<Vars['optional']>().toEqualTypeOf<unknown>()
    expectTypeOf<Vars['defaulted']>().toEqualTypeOf<unknown>()
    // Known limitation: because `undefined extends unknown`, `RelaxedOptional`
    // can't distinguish required (`!`) from nullable/defaulted modifiers when
    // the value type is `unknown` — all keys collapse to optional. So we don't
    // assert required/optional key shape here; only value + key presence.
    expectTypeOf<keyof Vars>().toEqualTypeOf<'id' | 'optional' | 'defaulted'>()
  })

  test('UnknownSchema returned from createGazania(url: string) is the same typed-unknown builder', () => {
    const g = createGazania('https://api.example.com/graphql')
    const _doc = g.query().select($ => $.select(['id']))

    expectTypeOf<ResultOf<typeof _doc>>().toEqualTypeOf<{ id: unknown }>()
  })
})

describe('public selection helper types are importable from root entry', () => {
  test('RootDollar is exported', () => {
    expectTypeOf<RootDollar<any>>().not.toBeNever()
  })

  test('ObjectFieldDollar is exported', () => {
    expectTypeOf<ObjectFieldDollar<any, any>>().not.toBeNever()
  })

  test('ScalarFieldDollar is exported', () => {
    expectTypeOf<ScalarFieldDollar<any, any>>().not.toBeNever()
  })

  test('TypedSelectionSet is exported', () => {
    expectTypeOf<TypedSelectionSet>().not.toBeNever()
  })

  test('TypedScalarSelection is exported', () => {
    expectTypeOf<TypedScalarSelection>().not.toBeNever()
  })

  test('PrepareSelection is exported', () => {
    expectTypeOf<PrepareSelection<any>>().not.toBeNever()
  })
})
