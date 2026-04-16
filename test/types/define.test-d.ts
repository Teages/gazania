import type { BaseObject, BaseScalar, BaseType, DefineSchema } from '../../src/types/define'
import type {
  Enum_CategoryEnum,
  Input_SayingDataInput,
  Interface_ItemWithId,
  Scalar_Boolean,
  Scalar_Int,
  Scalar_String,
  Schema,
  Type_Query,
  Type_Saying,
  Type_User,
  Union_Data,
} from './schema'
import { describe, expectTypeOf, test } from 'vitest'

describe('types/define', () => {
  test('ScalarType extends BaseScalar', () => {
    expectTypeOf<Scalar_Int>().toExtend<BaseScalar<'Int', number, number>>()
    expectTypeOf<Scalar_String>().toExtend<BaseScalar<'String', string, string>>()
    expectTypeOf<Scalar_Boolean>().toExtend<BaseScalar<'Boolean', boolean, boolean>>()
  })

  test('ScalarType extends BaseType', () => {
    expectTypeOf<Scalar_Int>().toExtend<BaseType<'BaseScalar', 'Int'>>()
  })

  test('EnumType extends BaseScalar', () => {
    expectTypeOf<Enum_CategoryEnum>().toExtend<BaseScalar<'CategoryEnum', 'funny' | 'jokes' | 'serious', any>>()
  })

  test('ObjectType extends BaseObject', () => {
    expectTypeOf<Type_User>().toExtend<BaseObject<'User', any, any>>()
    expectTypeOf<Type_Saying>().toExtend<BaseObject<'Saying', any, any>>()
    expectTypeOf<Type_Query>().toExtend<BaseObject<'Query', any, any>>()
  })

  test('UnionType extends BaseObject', () => {
    expectTypeOf<Union_Data>().toExtend<BaseObject<'Data', any, any>>()
  })

  test('InterfaceType extends BaseObject', () => {
    expectTypeOf<Interface_ItemWithId>().toExtend<BaseObject<'ItemWithId', any, any>>()
  })

  test('InputObjectType extends BaseType', () => {
    expectTypeOf<Input_SayingDataInput>().toExtend<BaseType<'InputObject', 'SayingDataInput'>>()
  })

  test('DefineSchema holds all namespace types', () => {
    expectTypeOf<Schema>().toExtend<DefineSchema<any>>()
  })
})
