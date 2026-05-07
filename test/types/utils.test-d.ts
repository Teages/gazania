import type { TypedGazania } from '../../src/types/builder'
import type { Input } from '../../src/types/define'
import type { ParseObjectSelectionContextField } from '../../src/types/result'
import type { FindType, ModifiedName, RequireInput, RequireInputOrVariable, SchemaRequire, Typename, TypenameField, WrapFieldResult } from '../../src/types/utils'
import type { Variable } from '../../src/types/variable'
import type {
  Enum_CategoryEnum,
  Input_SayingDataInput,
  Input_SayingWithSloganInput,
  Interface_ItemWithId,
  Scalar_Boolean,
  Scalar_Date,
  Scalar_Float,
  Scalar_ID,
  Scalar_Int,
  Scalar_MaybeInt,
  Scalar_String,
  Schema,
  Type_Mutation,
  Type_Query,
  Type_Saying,
  Type_Subscription,
  Type_User,
  Union_Data,
} from './schema'
import { describe, expectTypeOf, test } from 'vitest'

describe('types/utils', () => {
  test('TypenameField', () => {
    expectTypeOf<
      ParseObjectSelectionContextField<TypenameField<'Name'>, true>
    >().toEqualTypeOf<'Name'>()
  })

  test('Typename', () => {
    expectTypeOf<Typename<Type_Saying>>().toEqualTypeOf<'Saying'>()
    expectTypeOf<Typename<Type_User>>().toEqualTypeOf<'User'>()
    expectTypeOf<Typename<Type_Mutation>>().toEqualTypeOf<'Mutation'>()
    expectTypeOf<Typename<Type_Query>>().toEqualTypeOf<'Query'>()
    expectTypeOf<Typename<Type_Subscription>>().toEqualTypeOf<'Subscription'>()
    expectTypeOf<Typename<Union_Data>>().toEqualTypeOf<'Saying' | 'User'>()
    expectTypeOf<Typename<Interface_ItemWithId>>().toEqualTypeOf<'Saying' | 'User'>()
  })

  test('ModifiedName', () => {
    expectTypeOf<ModifiedName<'String'>>().toEqualTypeOf<'String'>()
    expectTypeOf<ModifiedName<'String!'>>().toEqualTypeOf<'String'>()
    expectTypeOf<ModifiedName<'String!!'>>().toEqualTypeOf<never>()
    expectTypeOf<ModifiedName<'[String]'>>().toEqualTypeOf<'String'>()
    expectTypeOf<ModifiedName<'[String!]'>>().toEqualTypeOf<'String'>()
    expectTypeOf<ModifiedName<'[String]!'>>().toEqualTypeOf<'String'>()
    expectTypeOf<ModifiedName<'[String!]!'>>().toEqualTypeOf<'String'>()
  })

  test('FindType', () => {
    expectTypeOf<FindType<Schema, 'Int'>>().toEqualTypeOf<Scalar_Int>()
    expectTypeOf<FindType<Schema, 'Float'>>().toEqualTypeOf<Scalar_Float>()
    expectTypeOf<FindType<Schema, 'String'>>().toEqualTypeOf<Scalar_String>()
    expectTypeOf<FindType<Schema, 'Boolean'>>().toEqualTypeOf<Scalar_Boolean>()
    expectTypeOf<FindType<Schema, 'ID'>>().toEqualTypeOf<Scalar_ID>()
    expectTypeOf<FindType<Schema, 'Date'>>().toEqualTypeOf<Scalar_Date>()
    expectTypeOf<FindType<Schema, 'SayingDataInput'>>().toEqualTypeOf<Input_SayingDataInput>()
    expectTypeOf<FindType<Schema, 'CategoryEnum'>>().toEqualTypeOf<Enum_CategoryEnum>()
    expectTypeOf<FindType<Schema, 'ItemWithId'>>().toEqualTypeOf<Interface_ItemWithId>()
    expectTypeOf<FindType<Schema, 'Saying'>>().toEqualTypeOf<Type_Saying>()
    expectTypeOf<FindType<Schema, 'User'>>().toEqualTypeOf<Type_User>()
    expectTypeOf<FindType<Schema, 'Mutation'>>().toEqualTypeOf<Type_Mutation>()
    expectTypeOf<FindType<Schema, 'Query'>>().toEqualTypeOf<Type_Query>()
    expectTypeOf<FindType<Schema, 'Subscription'>>().toEqualTypeOf<Type_Subscription>()
  })

  test('RequireInput', () => {
    expectTypeOf<RequireInput<Input<Scalar_Int | null>>>()
      .toEqualTypeOf<number | null | undefined>()
    expectTypeOf<RequireInput<Input<Scalar_Int>>>()
      .toEqualTypeOf<number>()
    expectTypeOf<RequireInput<Input<Scalar_Int[]>>>()
      .toEqualTypeOf<number[] | number>()
    expectTypeOf<RequireInput<Input<Input_SayingDataInput>>>()
      .toEqualTypeOf<{ category: 'funny' | 'jokes' | 'serious', content: string }>()
    expectTypeOf<RequireInput<Input<Input_SayingDataInput[]>>>()
      .toEqualTypeOf<
        | { category: 'funny' | 'jokes' | 'serious', content: string }[]
        | { category: 'funny' | 'jokes' | 'serious', content: string }
    >()
    // Nullable input object field becomes an optional key
    expectTypeOf<RequireInput<Input<Input_SayingWithSloganInput>>>()
      .toEqualTypeOf<{ category: 'funny' | 'jokes' | 'serious', content: string, slogan?: string | null | undefined }>()
    // Scalar whose own Input type includes null:
    // MaybeInt! → scalar's own null is preserved (not a nullable field wrapper)
    expectTypeOf<RequireInput<Input<Scalar_MaybeInt>>>()
      .toEqualTypeOf<number | null>()
    // MaybeInt  → nullable field adds | undefined on top of scalar's own null
    expectTypeOf<RequireInput<Input<Scalar_MaybeInt | null>>>()
      .toEqualTypeOf<number | null | undefined>()
  })

  test('RequireInputOrVariable', () => {
    expectTypeOf<RequireInputOrVariable<Input<Scalar_Int | null>>>()
      .toEqualTypeOf<number | Variable<'Int!'> | Variable<'Int'> | null | undefined>()
    expectTypeOf<RequireInputOrVariable<Input<Scalar_Int>>>()
      .toEqualTypeOf<number | Variable<'Int!'>>()
    expectTypeOf<RequireInputOrVariable<Input<Scalar_Int[]>>>()
      .toEqualTypeOf<number[] | number | Variable<'[Int!]!'> | Variable<'Int!'>>()
    expectTypeOf<RequireInputOrVariable<Input<(Scalar_Int | null)[]>>>()
      .toEqualTypeOf<
        | number | (number | null | undefined)[]
        | Variable<'[Int]!'> | Variable<'[Int!]!'>
        | Variable<'Int!'>
    >()
    expectTypeOf<RequireInputOrVariable<Input<Scalar_Int[] | null>>>()
      .toEqualTypeOf<
        | number[] | number
        | Variable<'[Int!]'> | Variable<'[Int!]!'>
        | Variable<'Int!'> | Variable<'Int'>
        | null | undefined
    >()
    expectTypeOf<RequireInputOrVariable<Input<(Scalar_Int | null)[] | null>>>()
      .toEqualTypeOf<
        | number | (number | null | undefined)[]
        | Variable<'[Int]'> | Variable<'[Int]!'> | Variable<'[Int!]'> | Variable<'[Int!]!'>
        | Variable<'Int!'> | Variable<'Int'>
        | null | undefined
    >()
    expectTypeOf<RequireInputOrVariable<Input<Input_SayingDataInput>>>()
      .toEqualTypeOf<
        | {
          category: (() => 'funny') | (() => 'jokes') | (() => 'serious') | Variable<'CategoryEnum!'>
          content: string | Variable<'String!'>
        }
        | Variable<'SayingDataInput!'>
    >()
    expectTypeOf<RequireInputOrVariable<Input<Input_SayingDataInput[]>>>()
      .toEqualTypeOf<
        | {
          category: (() => 'funny') | (() => 'jokes') | (() => 'serious') | Variable<'CategoryEnum!'>
          content: string | Variable<'String!'>
        }[]
        | {
          category: (() => 'funny') | (() => 'jokes') | (() => 'serious') | Variable<'CategoryEnum!'>
          content: string | Variable<'String!'>
        }
        | Variable<'[SayingDataInput!]!'>
        | Variable<'SayingDataInput!'>
    >()
    // Nullable input object field becomes an optional key
    expectTypeOf<RequireInputOrVariable<Input<Input_SayingWithSloganInput>>>()
      .toEqualTypeOf<
        | {
          category: (() => 'funny') | (() => 'jokes') | (() => 'serious') | Variable<'CategoryEnum!'>
          content: string | Variable<'String!'>
          slogan?: string | Variable<'String!'> | Variable<'String'> | null | undefined
        }
        | Variable<'SayingWithSloganInput!'>
    >()
  })

  test('WrapFieldResult', () => {
    // null in field type → null | undefined in output (nullable = absent or explicit null)
    expectTypeOf<WrapFieldResult<Scalar_String | null, string>>()
      .toEqualTypeOf<string | null | undefined>()
    expectTypeOf<WrapFieldResult<Scalar_String, string>>()
      .toEqualTypeOf<string>()
    expectTypeOf<WrapFieldResult<Scalar_String[], string>>()
      .toEqualTypeOf<string[]>()
    // nullable array items also get | undefined
    expectTypeOf<WrapFieldResult<(Scalar_String | null)[], string>>()
      .toEqualTypeOf<(string | null | undefined)[]>()
    // nullable outer + nullable items
    expectTypeOf<WrapFieldResult<(Scalar_String | null)[] | null, string>>()
      .toEqualTypeOf<(string | null | undefined)[] | null | undefined>()
    expectTypeOf<WrapFieldResult<Scalar_String[][], string>>()
      .toEqualTypeOf<string[][]>()
    // invalid (never base) stays never
    expectTypeOf<WrapFieldResult<never, string>>()
      .toEqualTypeOf<never>()
    // Scalar with nullable Output (e.g. ScalarType<'MaybeInt', number | null, ...>):
    // The field wrapper null is separate from the scalar's own null.
    // MaybeInt! field: U = number | null, no | undefined added (non-null field)
    expectTypeOf<WrapFieldResult<Scalar_MaybeInt, number | null>>()
      .toEqualTypeOf<number | null>()
    // MaybeInt field: U = number | null, plus | undefined (nullable field → absent)
    expectTypeOf<WrapFieldResult<Scalar_MaybeInt | null, number | null>>()
      .toEqualTypeOf<number | null | undefined>()
  })

  test('SchemaRequire', () => {
    expectTypeOf<SchemaRequire<TypedGazania<Schema>, 'Int'>>()
      .toEqualTypeOf<number | null | undefined>()

    expectTypeOf<SchemaRequire<TypedGazania<Schema>, 'Int!'>>()
      .toEqualTypeOf<number>()

    expectTypeOf<SchemaRequire<TypedGazania<Schema>, '[Int]'>>()
      .toEqualTypeOf<(number | null | undefined)[] | number | null | undefined>()

    expectTypeOf<SchemaRequire<TypedGazania<Schema>, '[Int]!'>>()
      .toEqualTypeOf<(number | null | undefined)[] | number>()

    expectTypeOf<SchemaRequire<TypedGazania<Schema>, '[Int!]'>>()
      .toEqualTypeOf<number[] | number | null | undefined>()

    expectTypeOf<SchemaRequire<TypedGazania<Schema>, '[Int!]!'>>()
      .toEqualTypeOf<number[] | number>()

    expectTypeOf<SchemaRequire<TypedGazania<Schema>, 'SayingDataInput!'>>()
      .toEqualTypeOf<{ category: 'funny' | 'jokes' | 'serious', content: string }>()
    // Nullable-output scalar: MaybeInt! field → scalar's own null comes through
    expectTypeOf<SchemaRequire<TypedGazania<Schema>, 'MaybeInt!'>>()
      .toEqualTypeOf<number | null>()
    // Nullable field + nullable-output scalar: MaybeInt → also | undefined
    expectTypeOf<SchemaRequire<TypedGazania<Schema>, 'MaybeInt'>>()
      .toEqualTypeOf<number | null | undefined>()
  })
})
