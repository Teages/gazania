import type { RequireOperationPartialData, ResultOfSection } from '../../src/runtime/builder-types'
import type { ResultOf, VariablesOf } from '../../src/runtime/document'
import type { Schema, Type_Query } from './schema'
import { describe, expectTypeOf, test } from 'vitest'
import { createFragmentBuilder } from '../../src/runtime/builder/fragment'
import { createOperationBuilder } from '../../src/runtime/builder/operation'
import { createPartialBuilder } from '../../src/runtime/builder/partial'
import { createSectionBuilder } from '../../src/runtime/builder/section'

describe('runtime generic builders', () => {
  test('createOperationBuilder can carry schema-aware result and variable types', () => {
    const builder = createOperationBuilder<Schema, Type_Query>('query')
    const _doc = builder
      .vars({ includeHello: 'Boolean!' })
      .select(($, vars) => $.select([
        {
          hello: $ => $.args({ name: null }).directives(['@include', { if: vars.includeHello }]),
        },
      ]))

    expectTypeOf<ResultOf<typeof _doc>>().toEqualTypeOf<{
      hello: string | null | undefined
    }>()
    expectTypeOf<VariablesOf<typeof _doc>>().toEqualTypeOf<{
      readonly includeHello: boolean
    }>()
  })

  test('createFragmentBuilder can carry schema-aware result types', () => {
    const _doc = createFragmentBuilder<Schema>('QueryFields')
      .on('Query')
      .select($ => $.select(['hello', '__typename']))

    expectTypeOf<ResultOf<typeof _doc>>().toEqualTypeOf<{
      hello: string
      __typename: 'Query'
    }>()
  })

  test('createPartialBuilder can carry schema-aware package result types', () => {
    const _partial = createPartialBuilder<Schema, 'QueryPartial'>('QueryPartial')
      .on('Query')
      .select($ => $.select(['hello']))

    expectTypeOf<RequireOperationPartialData<typeof _partial>>().toEqualTypeOf<{
      hello: string
    }>()
  })

  test('createSectionBuilder can carry schema-aware package result types', () => {
    const _section = createSectionBuilder<Schema, 'QuerySection'>('QuerySection')
      .on('Query')
      .select($ => $.select(['hello']))

    expectTypeOf<ResultOfSection<typeof _section>>().toEqualTypeOf<{
      hello: string
    }>()
  })
})
