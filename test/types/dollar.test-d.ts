import type { ObjectFieldDollar, RootDollar, ScalarFieldDollar, ScalarFieldDollarAfterArgs, TypedScalarSelection, TypedSelectionSet } from '../../src/types/dollar'
import type { Type_User } from './schema'
import { describe, expectTypeOf, test } from 'vitest'

describe('types/dollar', () => {
  test('TypedSelectionSet phantom types', () => {
    type Set = TypedSelectionSet<{ id: number, name: string }>
    expectTypeOf<Set>().toBeObject()
  })

  test('TypedScalarSelection phantom types', () => {
    type Sel = TypedScalarSelection<false>
    expectTypeOf<Sel>().toBeObject()
  })

  test('ScalarFieldDollar extends TypedScalarSelection', () => {
    // ScalarFieldDollar IS a TypedScalarSelection<false> (can be returned directly)
    expectTypeOf<ScalarFieldDollar<string>>().toExtend<TypedScalarSelection<false>>()
  })

  test('ScalarFieldDollar.args when Args present', () => {
    type Dollar = ScalarFieldDollar<string, { name: string }>
    expectTypeOf<Dollar['args']>().not.toBeNever()
  })

  test('ScalarFieldDollar.args returns ScalarFieldDollarAfterArgs', () => {
    type Dollar = ScalarFieldDollar<string, { name: string }>
    expectTypeOf<Dollar['args']>().toBeFunction()
  })

  test('ScalarFieldDollar.args when no Args', () => {
    type Dollar = ScalarFieldDollar<string, Record<string, never>>
    expectTypeOf<Dollar['args']>().toBeNever()
  })

  test('ScalarFieldDollarAfterArgs extends TypedScalarSelection', () => {
    expectTypeOf<ScalarFieldDollarAfterArgs<string>>().toExtend<TypedScalarSelection<false>>()
  })

  test('ObjectFieldDollar has select method', () => {
    type Dollar = ObjectFieldDollar<Type_User>
    expectTypeOf<Dollar>().toHaveProperty('select')
    expectTypeOf<Dollar>().toHaveProperty('enum')
  })

  test('ObjectFieldDollar.args when Args present', () => {
    type Dollar = ObjectFieldDollar<Type_User, { id: number }>
    expectTypeOf<Dollar['args']>().not.toBeNever()
  })

  test('ObjectFieldDollar.args when no Args', () => {
    type Dollar = ObjectFieldDollar<Type_User, Record<string, never>>
    expectTypeOf<Dollar['args']>().toBeNever()
  })

  test('ObjectFieldDollar.select returns TypedSelectionSet', () => {
    type Dollar = ObjectFieldDollar<Type_User>
    // select should return TypedSelectionSet
    expectTypeOf<Dollar['select']>().toBeFunction()
  })

  test('ObjectFieldDollar pipeline: args -> directives -> select', () => {
    type Dollar = ObjectFieldDollar<Type_User, { id: number }>
    // After args, directives and select are available but not args
    type AfterArgs = ReturnType<Dollar['args']>
    expectTypeOf<AfterArgs>().toHaveProperty('directives')
    expectTypeOf<AfterArgs>().toHaveProperty('select')
  })

  test('RootDollar has select and enum', () => {
    type Root = RootDollar<Type_User>
    expectTypeOf<Root>().toHaveProperty('select')
    expectTypeOf<Root>().toHaveProperty('enum')
  })
})
