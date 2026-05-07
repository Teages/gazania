import type { OperationTypeObject, ResultOfSection, TypedFragmentBuilder, TypedFragmentBuilderOnType, TypedFragmentBuilderOnTypeWithVar, TypedGazania, TypedOperationBuilderWithoutVars, TypedPartialBuilder, TypedPartialBuilderOnType, TypedPartialBuilderOnTypeWithVar, TypedSectionBuilder, TypedSectionBuilderOnType, TypedSectionBuilderOnTypeWithVar, VariablesOfSection } from '../../src/types/builder'
import type { ResultOf, VariablesOf } from '../../src/types/document'
import type { RequireVariables, Variable } from '../../src/types/variable'
import type { Schema, Type_Mutation, Type_Query, Type_Subscription } from './schema'
import { describe, expectTypeOf, test } from 'vitest'

describe('types/builder', () => {
  test('OperationTypeObject resolves correct types', () => {
    expectTypeOf<OperationTypeObject<Schema, 'Query'>>()
      .toEqualTypeOf<Type_Query>()
    expectTypeOf<OperationTypeObject<Schema, 'Mutation'>>()
      .toEqualTypeOf<Type_Mutation>()
    expectTypeOf<OperationTypeObject<Schema, 'Subscription'>>()
      .toEqualTypeOf<Type_Subscription>()
  })

  test('TypedGazania has all operation methods', () => {
    type Gazania = TypedGazania<Schema>
    expectTypeOf<Gazania>().toHaveProperty('query')
    expectTypeOf<Gazania>().toHaveProperty('mutation')
    expectTypeOf<Gazania>().toHaveProperty('subscription')
    expectTypeOf<Gazania>().toHaveProperty('fragment')
    expectTypeOf<Gazania>().toHaveProperty('partial')
    expectTypeOf<Gazania>().toHaveProperty('enum')
  })

  test('TypedOperationBuilderWithoutVars has vars and select', () => {
    type Builder = TypedOperationBuilderWithoutVars<Schema, Type_Query>
    expectTypeOf<Builder>().toHaveProperty('vars')
    expectTypeOf<Builder>().toHaveProperty('select')
    expectTypeOf<Builder>().toHaveProperty('directives')
  })

  test('TypedOperationBuilderWithoutVars.select returns TypedDocumentNode', () => {
    const builder: TypedOperationBuilderWithoutVars<Schema, Type_Query> = null as any

    const _doc = builder.select($ => $.select(['hello', '__typename']))
    expectTypeOf<ResultOf<typeof _doc>>().toEqualTypeOf<{ hello: string, __typename: 'Query' }>()
    expectTypeOf<VariablesOf<typeof _doc>>().toEqualTypeOf<Record<string, never>>()
  })

  test('TypedOperationBuilderWithVars.select returns typed variables', () => {
    const builder: TypedOperationBuilderWithoutVars<Schema, Type_Query> = null as any

    // Test that .vars() returns TypedOperationBuilderWithVars
    const withVars = builder.vars({ name: 'String! = "world"' })
    expectTypeOf(withVars).toHaveProperty('select')
    expectTypeOf(withVars).toHaveProperty('directives')

    // Test the select callback with simpler scalar selection
    const _doc = withVars.select(($, _vars) => {
      return $.select(['hello', '__typename'])
    })
    expectTypeOf<ResultOf<typeof _doc>>().toEqualTypeOf<{ hello: string, __typename: 'Query' }>()

    // Test RequireVariables directly
    type TestVars = RequireVariables<Schema, { name: 'String! = "world"' }>
    expectTypeOf<TestVars>().toEqualTypeOf<{ name?: string | undefined }>()
  })

  test('TypedFragmentBuilder', () => {
    type FB = TypedFragmentBuilder<Schema>
    expectTypeOf<FB>().toHaveProperty('on')
  })

  test('TypedFragmentBuilderOnType has vars, directives, and select', () => {
    type FB = TypedFragmentBuilderOnType<Schema, Type_Query>
    expectTypeOf<FB>().toHaveProperty('vars')
    expectTypeOf<FB>().toHaveProperty('directives')
    expectTypeOf<FB>().toHaveProperty('select')
  })

  test('TypedFragmentBuilderOnType.directives returns self', () => {
    type FB = TypedFragmentBuilderOnType<Schema, Type_Query>
    type Result = ReturnType<FB['directives']>
    expectTypeOf<Result>().toEqualTypeOf<FB>()
  })

  test('TypedFragmentBuilderOnTypeWithVar has directives and select', () => {
    type FB = TypedFragmentBuilderOnTypeWithVar<Schema, Type_Query, { skip: 'Boolean!' }>
    expectTypeOf<FB>().toHaveProperty('directives')
    expectTypeOf<FB>().toHaveProperty('select')
  })

  test('TypedFragmentBuilderOnTypeWithVar.directives returns self', () => {
    type FB = TypedFragmentBuilderOnTypeWithVar<Schema, Type_Query, { skip: 'Boolean!' }>
    type Result = ReturnType<FB['directives']>
    expectTypeOf<Result>().toEqualTypeOf<FB>()
  })

  test('TypedPartialBuilder', () => {
    type PB = TypedPartialBuilder<Schema>
    expectTypeOf<PB>().toHaveProperty('on')
  })

  test('TypedSectionBuilder', () => {
    type SB = TypedSectionBuilder<Schema>
    expectTypeOf<SB>().toHaveProperty('on')
  })

  test('TypedSectionBuilderOnType has vars, directives, and select', () => {
    type SB = TypedSectionBuilderOnType<Schema, Type_Query>
    expectTypeOf<SB>().toHaveProperty('vars')
    expectTypeOf<SB>().toHaveProperty('directives')
    expectTypeOf<SB>().toHaveProperty('select')
  })

  test('TypedSectionBuilderOnType.directives returns self', () => {
    type SB = TypedSectionBuilderOnType<Schema, Type_Query>
    type Result = ReturnType<SB['directives']>
    expectTypeOf<Result>().toEqualTypeOf<SB>()
  })

  test('TypedSectionBuilderOnTypeWithVar has directives and select', () => {
    type SB = TypedSectionBuilderOnTypeWithVar<Schema, Type_Query, { skip: 'Boolean!' }>
    expectTypeOf<SB>().toHaveProperty('directives')
    expectTypeOf<SB>().toHaveProperty('select')
  })

  test('TypedGazania has all operation methods', () => {
    type Gazania = TypedGazania<Schema>
    expectTypeOf<Gazania>().toHaveProperty('query')
    expectTypeOf<Gazania>().toHaveProperty('mutation')
    expectTypeOf<Gazania>().toHaveProperty('subscription')
    expectTypeOf<Gazania>().toHaveProperty('fragment')
    expectTypeOf<Gazania>().toHaveProperty('partial')
    expectTypeOf<Gazania>().toHaveProperty('section')
    expectTypeOf<Gazania>().toHaveProperty('enum')
  })

  test('TypedPartialBuilderOnType has vars, directives, and select', () => {
    type PB = TypedPartialBuilderOnType<Schema, Type_Query>
    expectTypeOf<PB>().toHaveProperty('vars')
    expectTypeOf<PB>().toHaveProperty('directives')
    expectTypeOf<PB>().toHaveProperty('select')
  })

  test('TypedPartialBuilderOnType.directives returns self', () => {
    type PB = TypedPartialBuilderOnType<Schema, Type_Query>
    type Result = ReturnType<PB['directives']>
    expectTypeOf<Result>().toEqualTypeOf<PB>()
  })

  test('TypedPartialBuilderOnTypeWithVar has directives and select', () => {
    type PB = TypedPartialBuilderOnTypeWithVar<Schema, Type_Query, { skip: 'Boolean!' }>
    expectTypeOf<PB>().toHaveProperty('directives')
    expectTypeOf<PB>().toHaveProperty('select')
  })

  test('TypedPartialBuilderOnTypeWithVar.directives returns self', () => {
    type PB = TypedPartialBuilderOnTypeWithVar<Schema, Type_Query, { skip: 'Boolean!' }>
    type Result = ReturnType<PB['directives']>
    expectTypeOf<Result>().toEqualTypeOf<PB>()
  })

  test('ResultOfSection extracts result type from TypedSectionPackage', () => {
    const g = null as unknown as TypedGazania<Schema>
    const _section = g.section('UserBasic').on('User').select($ => $.select(['id', 'name']))
    type Result = ResultOfSection<typeof _section>
    expectTypeOf<Result>().toEqualTypeOf<{ id: number, name: string }>()
  })

  test('ResultOfSection returns never for non-section types', () => {
    expectTypeOf<ResultOfSection<string>>().toBeNever()
    expectTypeOf<ResultOfSection<unknown>>().toBeNever()
  })

  test('VariablesOfSection extracts variables type from TypedSectionPackage', () => {
    const g = null as unknown as TypedGazania<Schema>
    const _section = g.section('UserBasic')
      .on('User')
      .vars({ id: 'Int!' })
      .select(($, _vars) => $.select(['id', 'name']))
    type Vars = VariablesOfSection<typeof _section>
    expectTypeOf<Vars>().toEqualTypeOf<{ id: Variable<'Int!'> }>()
  })

  test('VariablesOfSection returns never for non-section types', () => {
    expectTypeOf<VariablesOfSection<string>>().toBeNever()
    expectTypeOf<VariablesOfSection<unknown>>().toBeNever()
  })
})
