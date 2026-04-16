import type { RequireOperationPartialData, TypedGazania, TypedPartialPackage } from '../../src/types/builder'
import type { ResultOf } from '../../src/types/document'
import type { FragmentOf, FragmentRef } from '../../src/types/masking'
import type { AnalyzedObjectSelection, ParseObjectSelection, ParseObjectSelectionContext } from '../../src/types/result'
import type { Schema, Type_User } from './schema'
import { describe, expectTypeOf, test } from 'vitest'
import { readFragment } from '../../src'

describe('types/masking', () => {
  test('FragmentRef creates opaque marker type', () => {
    type Ref = FragmentRef<'UserFields', 'User'>
    expectTypeOf<Ref>().toHaveProperty(' $fragmentRefs')
  })

  test('FragmentRef types with different names are distinct', () => {
    type RefA = FragmentRef<'UserFields', 'User'>
    type RefB = FragmentRef<'SayingFields', 'Saying'>
    expectTypeOf<RefA>().not.toEqualTypeOf<RefB>()
  })

  test('TypedPartialPackage carries Name type parameter', () => {
    type Pkg = TypedPartialPackage<Type_User, { id: number, name: string }, Record<string, never>, 'UserFields'>

    // The callable should return a typed partial spread
    type Ref = ReturnType<Pkg>
    expectTypeOf<Ref>().toBeArray()
  })

  test('FragmentOf extracts FragmentRef from TypedPartialPackage', () => {
    type Pkg = TypedPartialPackage<Type_User, { id: number, name: string }, Record<string, never>, 'UserFields'>
    type Ref = FragmentOf<Pkg>
    expectTypeOf<Ref>().toEqualTypeOf<FragmentRef<'UserFields', 'User'>>()
  })

  test('RequireOperationPartialData extracts result from 4-param TypedPartialPackage', () => {
    type Pkg = TypedPartialPackage<Type_User, { id: number, name: string }, Record<string, never>, 'UserFields'>
    type Data = RequireOperationPartialData<Pkg>
    expectTypeOf<Data>().toEqualTypeOf<{ id: number, name: string }>()
  })

  test('AnalyzedObjectSelection handles partial spread entries', () => {
    // A selection like: [{ '$partial:UserFields': FragmentRef<'UserFields', 'User'> }, '__typename']
    type Selection = [{ readonly '$partial:UserFields': FragmentRef<'UserFields', 'User'> }, '__typename']
    type Analyzed = AnalyzedObjectSelection<Selection>

    // Should contain both the partial spread key and __typename
    expectTypeOf<Analyzed>().toHaveProperty('__typename')
    expectTypeOf<Analyzed>().toHaveProperty('$partial:UserFields')
  })

  test('ParseObjectSelectionContext extracts FragmentRef from partial spread keys', () => {
    // Context with a partial spread key and a regular field
    interface Context {
      '__typename': true
      '$partial:UserFields': FragmentRef<'UserFields', 'User'>
    }
    type Result = ParseObjectSelectionContext<Type_User, Context>

    // Result should be { __typename: 'User' } & FragmentRef<'UserFields', 'User'>
    expectTypeOf<Result>().toHaveProperty('__typename')
    expectTypeOf<Result>().toHaveProperty(' $fragmentRefs')
  })

  test('ParseObjectSelection with partial spread produces masked result', () => {
    // Selection array: [{ '$partial:UserFields': FragmentRef }, '__typename']
    type Selection = [{ readonly '$partial:UserFields': FragmentRef<'UserFields', 'User'> }, '__typename']
    type Result = ParseObjectSelection<Type_User, Selection>

    // Result should include both __typename and the fragment ref
    expectTypeOf<Result>().toHaveProperty('__typename')
    expectTypeOf<Result>().toHaveProperty(' $fragmentRefs')
  })

  test('ParseObjectSelectionContext with no partial spreads preserves existing behavior', () => {
    // Regular context without partials — should work as before
    interface Context { __typename: true, name: true }
    type Result = ParseObjectSelectionContext<Type_User, Context>
    expectTypeOf<Result>().toEqualTypeOf<{ __typename: 'User', name: string }>()
  })

  test('Multiple partial spreads are intersected', () => {
    interface Context {
      '__typename': true
      '$partial:UserBasic': FragmentRef<'UserBasic', 'User'>
      '$partial:UserEmail': FragmentRef<'UserEmail', 'User'>
    }
    type Result = ParseObjectSelectionContext<Type_User, Context>

    // Should have __typename and both fragment refs
    expectTypeOf<Result>().toHaveProperty('__typename')
    expectTypeOf<Result>().toHaveProperty(' $fragmentRefs')

    // The $fragmentRefs should contain both UserBasic and UserEmail
    type Refs = NonNullable<Result[' $fragmentRefs']>
    expectTypeOf<Refs>().toHaveProperty('UserBasic')
    expectTypeOf<Refs>().toHaveProperty('UserEmail')
  })

  test('TypedGazania.partial captures fragment name literal', () => {
    type Gazania = TypedGazania<Schema>
    const g: Gazania = null as any

    // partial() should infer literal type for name
    const builder = g.partial('UserFields')
    expectTypeOf(builder).toHaveProperty('on')

    // After .on() and .select(), the package should carry the name
    const _partial = builder.on('User').select($ => $.select(['id', 'name']))
    type Pkg = typeof _partial
    expectTypeOf<FragmentOf<Pkg>>().toEqualTypeOf<FragmentRef<'UserFields', 'User'>>()
  })

  test('readFragment type: partial package → result extraction', () => {
    type Pkg = TypedPartialPackage<Type_User, { id: number, name: string }, Record<string, never>, 'UserFields'>
    type Data = RequireOperationPartialData<Pkg>
    type Ref = FragmentOf<Pkg>

    // The ref should be the opaque fragment marker
    expectTypeOf<Ref>().toEqualTypeOf<FragmentRef<'UserFields', 'User'>>()
    // The data should be the concrete result
    expectTypeOf<Data>().toEqualTypeOf<{ id: number, name: string }>()
  })

  test('End-to-end: query result with partial spread is masked', () => {
    type Gazania = TypedGazania<Schema>
    const g: Gazania = null as any

    const userPartial = g.partial('UserFields')
      .on('User')
      .select($ => $.select(['id', 'name', 'email']))

    // FragmentOf should give the opaque ref
    type UserRef = FragmentOf<typeof userPartial>
    expectTypeOf<UserRef>().toEqualTypeOf<FragmentRef<'UserFields', 'User'>>()

    // RequireOperationPartialData should give the concrete type
    type UserData = RequireOperationPartialData<typeof userPartial>
    expectTypeOf<UserData>().toEqualTypeOf<{ id: number, name: string, email: string }>()

    // Build a query that uses the partial
    const _query = g.query('GetUser')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          ...userPartial(vars),
          '__typename',
        ]),
      }]))

    type QueryResult = ResultOf<typeof _query>
    // user should be masked — contains __typename and fragment ref, not the fragment's fields directly
    expectTypeOf<QueryResult>().toHaveProperty('user')

    // The user field should have __typename
    type UserField = QueryResult['user']
    expectTypeOf<UserField>().toHaveProperty('__typename')

    // The user field should have the fragment ref marker
    expectTypeOf<UserField>().toHaveProperty(' $fragmentRefs')
  })

  test('End-to-end: query result with multiple partial spreads', () => {
    type Gazania = TypedGazania<Schema>
    const g: Gazania = null as any

    const userBasic = g.partial('UserBasic')
      .on('User')
      .select($ => $.select(['id', 'name']))

    const userEmail = g.partial('UserEmail')
      .on('User')
      .select($ => $.select(['email']))

    const _query = g.query('GetUser')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          ...userBasic(vars),
          ...userEmail(vars),
          '__typename',
        ]),
      }]))

    type QueryResult = ResultOf<typeof _query>
    type UserField = QueryResult['user']

    // Should have __typename
    expectTypeOf<UserField>().toHaveProperty('__typename')

    // Should have fragment refs for both partials
    expectTypeOf<UserField>().toHaveProperty(' $fragmentRefs')

    // The refs should contain both
    type Refs = NonNullable<UserField[' $fragmentRefs']>
    expectTypeOf<Refs>().toHaveProperty('UserBasic')
    expectTypeOf<Refs>().toHaveProperty('UserEmail')
  })

  test('End-to-end: partial on different type (Saying)', () => {
    type Gazania = TypedGazania<Schema>
    const g: Gazania = null as any

    const _sayingPartial = g.partial('SayingFields')
      .on('Saying')
      .select($ => $.select(['id', 'content', 'category']))

    type SayingRef = FragmentOf<typeof _sayingPartial>
    expectTypeOf<SayingRef>().toEqualTypeOf<FragmentRef<'SayingFields', 'Saying'>>()

    type SayingData = RequireOperationPartialData<typeof _sayingPartial>
    expectTypeOf<SayingData>().toEqualTypeOf<{ id: number, content: string, category: 'funny' | 'jokes' | 'serious' }>()
  })

  test('readFragment: single non-nullable ref returns result', () => {
    type Pkg = TypedPartialPackage<Type_User, { id: number, name: string }, Record<string, never>, 'UserFields'>
    const pkg: Pkg = null as any
    const ref: FragmentOf<Pkg> = null as any

    const result = readFragment(pkg, ref)
    expectTypeOf(result).toEqualTypeOf<{ id: number, name: string }>()
  })

  test('readFragment: nullable ref returns result | null | undefined', () => {
    type Pkg = TypedPartialPackage<Type_User, { id: number, name: string }, Record<string, never>, 'UserFields'>
    const pkg: Pkg = null as any
    const ref: FragmentOf<Pkg> | null | undefined = null as any

    const result = readFragment(pkg, ref)
    expectTypeOf(result).toEqualTypeOf<{ id: number, name: string } | null | undefined>()
  })

  test('readFragment: array of refs returns readonly array of results', () => {
    type Pkg = TypedPartialPackage<Type_User, { id: number, name: string }, Record<string, never>, 'UserFields'>
    const pkg: Pkg = null as any
    const refs: ReadonlyArray<FragmentOf<Pkg>> = null as any

    const result = readFragment(pkg, refs)
    expectTypeOf(result).toEqualTypeOf<ReadonlyArray<{ id: number, name: string }>>()
  })

  test('readFragment: array with nullable items returns readonly array of nullable results', () => {
    type Pkg = TypedPartialPackage<Type_User, { id: number, name: string }, Record<string, never>, 'UserFields'>
    const pkg: Pkg = null as any
    const refs: ReadonlyArray<FragmentOf<Pkg> | null | undefined> = null as any

    const result = readFragment(pkg, refs)
    expectTypeOf(result).toEqualTypeOf<ReadonlyArray<{ id: number, name: string } | null | undefined>>()
  })
})
