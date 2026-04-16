import type { ResultOf, TypedDocumentNode, VariablesOf } from '../../src/types/document'
import { describe, expectTypeOf, test } from 'vitest'

describe('types/document', () => {
  test('TypedDocumentNode extends DocumentNode', () => {
    // TypedDocumentNode should be assignable with proper Result/Variables
    type TestDoc = TypedDocumentNode<{ hello: string }, { name: string }>
    expectTypeOf<TestDoc>().toHaveProperty('kind')
    expectTypeOf<TestDoc>().toHaveProperty('definitions')
  })

  test('ResultOf', () => {
    type TestDoc = TypedDocumentNode<{ hello: string }, { name: string }>
    expectTypeOf<ResultOf<TestDoc>>().toEqualTypeOf<{ hello: string }>()
  })

  test('VariablesOf', () => {
    type TestDoc = TypedDocumentNode<{ hello: string }, { name: string }>
    expectTypeOf<VariablesOf<TestDoc>>().toEqualTypeOf<{ name: string }>()
  })
})
