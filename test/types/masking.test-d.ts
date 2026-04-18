import type { RequireOperationPartialData, TypedGazania, TypedPartialPackage } from '../../src/types/builder'
import type { ResultOf } from '../../src/types/document'
import type { FragmentOf, FragmentRef } from '../../src/types/masking'
import type { AnalyzedObjectSelection, ParseObjectSelection, ParseObjectSelectionContext } from '../../src/types/result'
import type { Schema, Type_User } from './schema'
import { describe, expectTypeOf, test } from 'vitest'
import { createGazania, readFragment } from '../../src'

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

  test('AnalyzedObjectSelection handles section spread entries', () => {
    type Selection = [{ readonly '$section:UserBasic': { id: number, name: string } }, '__typename']
    type Analyzed = AnalyzedObjectSelection<Selection>

    expectTypeOf<Analyzed>().toHaveProperty('__typename')
    expectTypeOf<Analyzed>().toHaveProperty('$section:UserBasic')
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

  test('ParseObjectSelectionContext extracts section result from section spread keys', () => {
    interface Context {
      '__typename': true
      '$section:UserBasic': { id: number, name: string }
    }
    type Result = ParseObjectSelectionContext<Type_User, Context>

    expectTypeOf<Result>().toEqualTypeOf<{ __typename: 'User' } & { id: number, name: string }>()
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
    const g = createGazania({} as Schema)

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
    const g = createGazania({} as Schema)

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
    const g = createGazania({} as Schema)

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
    const g = createGazania({} as Schema)

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

  test('TypedGazania.section captures fragment name literal', () => {
    const g = createGazania({} as Schema)

    const _section = g.section('UserBasic')
      .on('User')
      .select($ => $.select(['id', 'name']))

    // section does not carry $fragmentOf — FragmentOf is not applicable
    type Pkg = typeof _section
    expectTypeOf<Pkg>().not.toHaveProperty(' $fragmentOf')

    // The callable should still return an array (section spread)
    type Ret = ReturnType<Pkg>
    expectTypeOf<Ret>().toBeArray()
  })

  test('End-to-end: query result with section spread has transparent fields', () => {
    const g = createGazania({} as Schema)

    const userSection = g.section('UserBasicFields')
      .on('User')
      .select($ => $.select(['id', 'name', 'email']))

    const _query = g.query('GetUsers')
      .select($ => $.select([{
        users: $ => $.select([
          ...userSection({}),
        ]),
      }]))

    type QueryResult = ResultOf<typeof _query>
    type UserItem = QueryResult['users'][number]

    // section fields are directly accessible — no masking
    expectTypeOf<UserItem>().toHaveProperty('id')
    expectTypeOf<UserItem>().toHaveProperty('name')
    expectTypeOf<UserItem>().toHaveProperty('email')

    // section does NOT add a $fragmentRefs marker
    expectTypeOf<UserItem>().not.toHaveProperty(' $fragmentRefs')
  })

  test('End-to-end: section and partial mixed — partial is masked, section is transparent', () => {
    const g = createGazania({} as Schema)

    const userSection = g.section('UserBasicFields')
      .on('User')
      .select($ => $.select(['id', 'name']))

    const userPartial = g.partial('UserEmail')
      .on('User')
      .select($ => $.select(['email']))

    const _query = g.query('GetUsers')
      .select($ => $.select([{
        users: $ => $.select([
          ...userSection({}),
          ...userPartial({}),
          '__typename',
        ]),
      }]))

    type QueryResult = ResultOf<typeof _query>
    type UserItem = QueryResult['users'][number]

    // Section fields are transparent
    expectTypeOf<UserItem>().toHaveProperty('id')
    expectTypeOf<UserItem>().toHaveProperty('name')
    expectTypeOf<UserItem>().toHaveProperty('__typename')

    // Partial is masked — email is NOT directly accessible
    expectTypeOf<UserItem>().not.toHaveProperty('email')

    // But the fragment ref marker IS present for the partial
    expectTypeOf<UserItem>().toHaveProperty(' $fragmentRefs')
    type Refs = NonNullable<UserItem[' $fragmentRefs']>
    expectTypeOf<Refs>().toHaveProperty('UserEmail')
  })

  test('End-to-end: multiple section spreads on same type are merged', () => {
    const g = createGazania({} as Schema)

    const nameSection = g.section('UserName')
      .on('User')
      .select($ => $.select(['id', 'name']))

    const emailSection = g.section('UserEmail')
      .on('User')
      .select($ => $.select(['email']))

    const _query = g.query('GetUsers')
      .select($ => $.select([{
        users: $ => $.select([
          ...nameSection({}),
          ...emailSection({}),
        ]),
      }]))

    type QueryResult = ResultOf<typeof _query>
    type UserItem = QueryResult['users'][number]

    // All fields from both sections are directly accessible
    expectTypeOf<UserItem>().toHaveProperty('id')
    expectTypeOf<UserItem>().toHaveProperty('name')
    expectTypeOf<UserItem>().toHaveProperty('email')

    // No masking at all
    expectTypeOf<UserItem>().not.toHaveProperty(' $fragmentRefs')
  })

  test('End-to-end: section with variables', () => {
    const g = createGazania({} as Schema)

    const userSection = g.section('UserWithSayings')
      .on('User')
      .vars({ category: 'CategoryEnum' })
      .select(($, vars) => $.select([
        'id',
        {
          sayings: $ => $.args({ category: vars.category }).select(['id', 'content']),
        },
      ]))

    const _query = g.query('GetUsers')
      .vars({ category: 'CategoryEnum' })
      .select(($, vars) => $.select([{
        users: $ => $.select([
          ...userSection(vars),
        ]),
      }]))

    type QueryResult = ResultOf<typeof _query>
    type UserItem = QueryResult['users'][number]

    // Section fields accessible without readFragment
    expectTypeOf<UserItem>().toHaveProperty('id')
    expectTypeOf<UserItem>().toHaveProperty('sayings')
  })

  test('section: FragmentOf<typeof section> resolves to never', () => {
    const g = createGazania({} as Schema)
    const _section = g.section('UserBasic').on('User').select($ => $.select(['id']))

    // TypedSectionPackage has no ' $fragmentOf' phantom, so FragmentOf resolves to never
    type Ref = FragmentOf<typeof _section>
    expectTypeOf<Ref>().toBeNever()
  })
})
