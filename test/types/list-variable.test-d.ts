import type { PrepareSelectionArgument } from '../../src/runtime/argument-types'
import type { TypedGazania } from '../../src/runtime/builder-types'
import type { DefineSchema, Field, Input, ObjectType } from '../../src/runtime/define'
import type { AcceptVariable, Variable } from '../../src/runtime/variable-types'
import type { Scalar_String } from './schema'
import { describe, expectTypeOf, test } from 'vitest'

type Issue34_Item = ObjectType<'Item', { id: Field<Scalar_String | null> }>
type Issue34_Schema = DefineSchema<{
  Query: ObjectType<'Query', {
    itemsById: Field<(Issue34_Item | null)[], { ids: Input<string[]> }>
  }>
}>

type NonNullStringListArg = PrepareSelectionArgument<{ ids: Input<Scalar_String[]> }>['ids']

describe('types/list-variable (issue #34)', () => {
  test('literal scalar coercion still allowed for list arguments', () => {
    expectTypeOf<'abc'>().toMatchTypeOf<NonNullStringListArg>()
    expectTypeOf<string[]>().toMatchTypeOf<NonNullStringListArg>()
  })

  test('list variables remain allowed for list arguments', () => {
    expectTypeOf<Variable<'[String!]!'>>().toMatchTypeOf<NonNullStringListArg>()
  })

  test('scalar variables are rejected for list arguments', () => {
    expectTypeOf<Variable<'String!'>>().not.toMatchTypeOf<NonNullStringListArg>()
    expectTypeOf<Variable<'String'>>().not.toMatchTypeOf<NonNullStringListArg>()
  })

  test('AcceptVariable does not widen list locations to scalar variables', () => {
    expectTypeOf<AcceptVariable<'[String!]!'>>()
      .toEqualTypeOf<Variable<'[String!]!'>>()

    expectTypeOf<AcceptVariable<'[String]!'>>()
      .toEqualTypeOf<Variable<'[String]!'> | Variable<'[String!]!'>>()

    expectTypeOf<AcceptVariable<'[String!]'>>()
      .toEqualTypeOf<Variable<'[String!]'> | Variable<'[String!]!'> | Variable<'[String!]!'>>()

    expectTypeOf<Variable<'[[String!]]'>>()
      .toMatchTypeOf<AcceptVariable<'[[String]]'>>()

    expectTypeOf<AcceptVariable<'[String]'>>()
      .toEqualTypeOf<
        | Variable<'[String]'>
        | Variable<'[String!]'>
        | Variable<'[String!]!'>
        | Variable<'[String!]!'>
        | Variable<'[String]!'>
    >()
  })

  test('query builder rejects scalar variables for list arguments', () => {
    const gazania = null as unknown as TypedGazania<Issue34_Schema>

    gazania.query('BadQuery')
      .vars({ id: 'String!' })
      .select(($, vars) => $.select([{
        itemsById: $ => $.args({
          // @ts-expect-error GraphQL §5.8.5: scalar variables cannot satisfy list arguments
          ids: vars.id,
        }).select(['id']),
      }]))
  })
})
