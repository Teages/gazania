import type { Field } from '../../src/types/define'
import type { TypedSelectionSet } from '../../src/types/dollar'
import type { AnalyzedObjectSelection, ParseInlineFragmentReturn, ParseObjectSelection, ParseObjectSelectionContext, ParseObjectSelectionContextField, ParseSelection, ParseSelectionName } from '../../src/types/result'
import type { Scalar_Boolean, Scalar_String, Type_Query, Type_User } from './schema'
import { describe, expectTypeOf, test } from 'vitest'

describe('types/result', () => {
  test('ParseSelection', () => {
    expectTypeOf<ParseSelection<Type_Query, ['hello', 'hi:hello', '__typename']>>()
      .toEqualTypeOf<{ hello: string, hi: string, __typename: 'Query' }>()

    expectTypeOf<ParseSelection<Scalar_Boolean, true>>()
      .toEqualTypeOf<boolean>()

    expectTypeOf<ParseSelection<Scalar_String, true>>()
      .toEqualTypeOf<string>()
  })

  test('ParseObjectSelection', () => {
    expectTypeOf<ParseObjectSelection<Type_Query, ['hello', 'hi:hello', '__typename']>>()
      .toEqualTypeOf<{ hello: string, hi: string, __typename: 'Query' }>()
  })

  test('ParseObjectSelectionContext', () => {
    expectTypeOf<ParseObjectSelectionContext<Type_Query, { hello: true }>>()
      .toEqualTypeOf<{ hello: string }>()
    // TypedSelectionSet now stores computed results, not raw selection arrays
    expectTypeOf<ParseObjectSelectionContext<Type_Query, { '...': () => TypedSelectionSet<{ hello: string }> }>>()
      .toEqualTypeOf<{ hello: string }>()
  })

  test('ParseObjectSelectionContextField', () => {
    expectTypeOf<ParseObjectSelectionContextField<
      Field<Scalar_String>,
      true
    >>().toEqualTypeOf<string>()

    expectTypeOf<ParseObjectSelectionContextField<
      Field<Type_User | null>,
      ['__typename', 'name', 'email']
    >>().toEqualTypeOf<{ __typename: 'User', name: string, email: string } | null | undefined>()

    expectTypeOf<ParseObjectSelectionContextField<
      Field<Type_User>,
      ['__typename', 'name', 'email']
    >>().toEqualTypeOf<{ __typename: 'User', name: string, email: string }>()

    expectTypeOf<ParseObjectSelectionContextField<
      Field<Type_User[]>,
      ['__typename', 'name', 'email']
    >>().toEqualTypeOf<{ __typename: 'User', name: string, email: string }[]>()
  })

  test('ParseSelectionName', () => {
    expectTypeOf<ParseSelectionName<'str'>>()
      .toEqualTypeOf<{ Field: 'str', Name: 'str' }>()

    expectTypeOf<ParseSelectionName<'a:b'>>()
      .toEqualTypeOf<{ Field: 'b', Name: 'a' }>()
    expectTypeOf<ParseSelectionName<'a: b'>>()
      .toEqualTypeOf<{ Field: 'b', Name: 'a' }>()
    expectTypeOf<ParseSelectionName<'a:  b'>>()
      .toEqualTypeOf<{ Field: 'b', Name: 'a' }>()
  })

  test('ParseObjectSelectionContextInlineFragments', () => {
    // TypedSelectionSet now stores computed results directly
    expectTypeOf<ParseInlineFragmentReturn<Type_User, () => TypedSelectionSet<{ __typename: 'User', name: string, email: string }>>>()
      .toEqualTypeOf<{ __typename: 'User', name: string, email: string }>()
    expectTypeOf<ParseInlineFragmentReturn<Type_User, () => TypedSelectionSet<{ __typename: 'User', name: string, email: string }, true>>>()
      .toEqualTypeOf<{ __typename: 'User' | null | undefined, name: string | null | undefined, email: string | null | undefined }>()
  })

  test('AnalyzedObjectSelection', () => {
    expectTypeOf<AnalyzedObjectSelection<[]>>()
      .toEqualTypeOf<unknown>()

    expectTypeOf<AnalyzedObjectSelection<['a', 'b']>>()
      .toEqualTypeOf<{ a: true, b: true }>()

    expectTypeOf<AnalyzedObjectSelection<['a', 'b', { c: true }]>>()
      .toEqualTypeOf<{ a: true, b: true, c: true }>()

    expectTypeOf<AnalyzedObjectSelection<['a', 'b', { c: true }, { d: true }]>>()
      .toEqualTypeOf<{ a: true, b: true, c: true, d: true }>()
  })
})
