import type { Field, ObjectType } from '../../src/types/define'
import type { ObjectSelection, ObjectSelectionContext, ObjectSelectionOnFields, ObjectSelectionOnInlineFragments, ObjectSelectionSimple, PrepareSelection, SelectionSimplyOnField, WithAlias } from '../../src/types/prepare'
import type {
  Enum_CategoryEnum,
  Interface_ItemWithId,
  Scalar_Int,
  Scalar_String,
  Type_Query,
  Type_User,
  Union_Data,
} from './schema'
import { describe, expectTypeOf, test } from 'vitest'

describe('types/prepare', () => {
  test('PrepareSelection', () => {
    expectTypeOf<PrepareSelection<Type_User>>()
      .toEqualTypeOf<ObjectSelection<Type_User>>()

    expectTypeOf<PrepareSelection<Interface_ItemWithId>>()
      .toEqualTypeOf<ObjectSelection<Interface_ItemWithId>>()

    expectTypeOf<PrepareSelection<Union_Data>>()
      .toEqualTypeOf<ObjectSelection<Union_Data>>()

    expectTypeOf<PrepareSelection<Enum_CategoryEnum>>()
      .toEqualTypeOf<true>()

    expectTypeOf<PrepareSelection<Scalar_String>>()
      .toEqualTypeOf<true>()
  })

  test('ObjectSelectionSimple', () => {
    expectTypeOf<ObjectSelectionSimple<ObjectSelectionContext<Type_User>>>()
      .toEqualTypeOf<
        | 'id'
        | 'email'
        | 'name'
        | '__typename'
        | `${string}:__typename`
        | `${string}:email`
        | `${string}:id`
        | `${string}:name`
        | `${string}: __typename`
        | `${string}: email`
        | `${string}: id`
        | `${string}: name`
    >()

    expectTypeOf<ObjectSelectionSimple<ObjectSelectionContext<Interface_ItemWithId>>>()
      .toEqualTypeOf<
        | 'id'
        | `__typename`
        | `${string}:id`
        | `${string}:__typename`
        | `${string}: id`
        | `${string}: __typename`
    >()
  })

  test('ObjectSelectionContext', () => {
    type PreparedQuery = ObjectSelectionContext<Type_Query>
    expectTypeOf<PreparedQuery>().toHaveProperty('__typename')
    expectTypeOf<PreparedQuery>().toHaveProperty('all')
    expectTypeOf<PreparedQuery>().toHaveProperty('allId')
    expectTypeOf<PreparedQuery>().toHaveProperty('hello')
    expectTypeOf<PreparedQuery>().toHaveProperty('saying')
    expectTypeOf<PreparedQuery>().toHaveProperty('sayings')
    expectTypeOf<PreparedQuery>().toHaveProperty('user')
    expectTypeOf<PreparedQuery>().toHaveProperty('users')
    expectTypeOf<PreparedQuery>().toHaveProperty('...')
  })

  test('ObjectSelectionOnFields', () => {
    type Type = ObjectType<'Saying', {
      id: Field<'Int!', Scalar_Int>
    }>

    expectTypeOf<ObjectSelectionOnFields<Type>>()
      .toHaveProperty('id')

    expectTypeOf<ObjectSelectionOnFields<Type>>()
      .toHaveProperty('__typename')

    expectTypeOf<ObjectSelectionOnFields<Type>>()
      .toHaveProperty('a: id')

    expectTypeOf<ObjectSelectionOnFields<Type>>()
      .toHaveProperty('a: __typename')

    expectTypeOf<ObjectSelectionOnFields<Type>>()
      .toHaveProperty('a:id')

    expectTypeOf<ObjectSelectionOnFields<Type>>()
      .toHaveProperty('a:__typename')
  })

  test('ObjectSelectionOnInlineFragments', () => {
    expectTypeOf<ObjectSelectionOnInlineFragments<Type_User>>()
      .toHaveProperty('...')

    expectTypeOf<ObjectSelectionOnInlineFragments<Interface_ItemWithId>>()
      .toHaveProperty('...')
    expectTypeOf<ObjectSelectionOnInlineFragments<Interface_ItemWithId>>()
      .toHaveProperty('... on Saying')
    expectTypeOf<ObjectSelectionOnInlineFragments<Interface_ItemWithId>>()
      .toHaveProperty('... on User')

    expectTypeOf<ObjectSelectionOnInlineFragments<Union_Data>>()
      .toHaveProperty('...')
    expectTypeOf<ObjectSelectionOnInlineFragments<Union_Data>>()
      .toHaveProperty('... on Saying')
    expectTypeOf<ObjectSelectionOnInlineFragments<Union_Data>>()
      .toHaveProperty('... on User')
  })

  test('SelectionSimplyOnField', () => {
    expectTypeOf<SelectionSimplyOnField<Scalar_Int, Record<string, never>>>()
      .toEqualTypeOf<true>()

    expectTypeOf<SelectionSimplyOnField<Enum_CategoryEnum, Record<string, never>>>()
      .toEqualTypeOf<true>()

    expectTypeOf<SelectionSimplyOnField<Type_User, Record<string, never>>>()
      .toEqualTypeOf<never>()
  })

  test('WithAlias', () => {
    expectTypeOf<WithAlias<'id'>>()
      .toEqualTypeOf<`${string}:id` | `${string}: id` | 'id'>()
  })
})
