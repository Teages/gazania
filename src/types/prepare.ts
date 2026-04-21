import type { PrepareSelectionArgument } from './argument'
import type { BaseObject, BaseScalar, BaseType, Field } from './define'
import type { ObjectFieldDollar, ScalarFieldDollar, TypedScalarSelection, TypedSelectionSet } from './dollar'
import type { PartialSpreadSelection } from './masking'
import type { BaseOf, TypenameField } from './utils'

/**
 * Produces the selection shape for a given schema type.
 *
 * No `Variables` parameter by design: TypeScript caches type expansions
 * by their full parameter signature, so `PrepareSelection<UserType>` is
 * expanded once and reused by every query that touches `User`, regardless
 * of the query's variables.
 */
export type PrepareSelection<T extends BaseType<any, any>>
  = T extends BaseObject<any, any, any>
    ? ObjectSelection<T>
    : T extends BaseScalar<any, any, any>
      ? ScalarSelection
      : never

// Scalar selection is simply `true`
export type ScalarSelection = true

export type ObjectSelection<T extends BaseObject<any, any, any>>
  = | ObjectSelectionSimple<ObjectSelectionContext<T>>[]
    | [...ObjectSelectionSimple<ObjectSelectionContext<T>>[], ObjectSelectionContext<T>]
    | [...(ObjectSelectionSimple<ObjectSelectionContext<T>> | PartialSpreadSelection)[], ObjectSelectionContext<T>]
    | (ObjectSelectionSimple<ObjectSelectionContext<T>> | PartialSpreadSelection)[]

// Extract keys whose value type includes `true` — these are the string-shorthand-eligible fields
export type ObjectSelectionSimple<Context> = keyof {
  [K in keyof Context as true extends Context[K] ? K : never]: true
}

export type ObjectSelectionContext<T extends BaseObject<any, any, any>>
  = ObjectSelectionOnFields<T> & ObjectSelectionOnInlineFragments<T>

export type ObjectSelectionOnFields<
  T extends BaseObject<any, any, any>,
> = T extends BaseObject<infer Name, infer Fields, any>
  ? (// When Fields is Record<string, never> (no fields, e.g. UnionType),
    // keyof Fields = string, which would create a string index signature
    // that conflicts with inline fragment callbacks. Skip in that case.
    (string extends keyof Fields
      // eslint-disable-next-line ts/no-empty-object-type
      ? {}
      : { [K in keyof Fields as WithAlias<K>]?: Fields[K] extends Field<any, any> ? SelectionOnField<Fields[K]> : never })
    & { [K in '__typename' as WithAlias<K>]?: SelectionOnField<TypenameField<Name>> })
  : never

export type ObjectSelectionOnInlineFragments<
  T extends BaseObject<any, any, any>,
> = T extends BaseObject<any, any, infer Implements>
  ? (// When Implements is Record<string, never> (no implementations, e.g. ObjectType),
    // keyof Implements = string, which would create a string index signature.
    // Skip the specific type inline fragments in that case.
    (string extends keyof Implements
      // eslint-disable-next-line ts/no-empty-object-type
      ? {}
      : { [K in keyof Implements as `... on ${K & string}`]?: SelectionFnOnInlineFragment<Implements[K]> })
    & { '...'?: SelectionFnOnInlineFragment<T> })
  : never

export type SelectionOnField<T extends Field<any, any>>
  = T extends Field<infer FieldType, infer Arguments>
    ? | SelectionSimplyOnField<BaseOf<FieldType>, PrepareSelectionArgument<Arguments>>
    | SelectionFnOnField<BaseOf<FieldType>, PrepareSelectionArgument<Arguments>>
    : never

// Simple (true) is only allowed for scalar fields with no required args
export type SelectionSimplyOnField<
  Type extends BaseType<any, any>,
  PreparedArguments extends Record<string, any>,
> = Record<string, never> extends PreparedArguments
  ? Type extends BaseScalar<any, any, any>
    ? true
    : never
  : never

// When Fields is Record<string, never> (no fields, e.g. UnionType),
// keyof Fields = string, which creates a string index signature
// conflicting with inline fragment callbacks. Skip in that case.
export type SelectionFnOnField<
  Type extends BaseType<any, any>,
  PreparedArguments extends Record<string, any>,
> = Type extends BaseScalar<any, infer Output, any>
  ? ($: ScalarFieldDollar<Output, PreparedArguments>) => TypedScalarSelection<boolean>
  : Type extends BaseObject<any, any, any>
    ? ($: ObjectFieldDollar<Type, PreparedArguments>) => TypedSelectionSet<any, boolean>
    : never

// Inline fragment callback
export type SelectionFnOnInlineFragment<
  T extends BaseObject<any, any, any>,
> = ($: ObjectFieldDollar<T, Record<string, never>>) => TypedSelectionSet<any, boolean>

export type AliasSpace = ' ' | ''
export type WithAlias<
  FieldName,
  AliasName = string,
> = FieldName extends string
  ? AliasName extends string
    ? `${AliasName}:${AliasSpace}${FieldName}` | FieldName
    : never
  : never
