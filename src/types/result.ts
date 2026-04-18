import type { BaseObject, BaseScalar, BaseType, Field } from './define'
import type { ExtractPartialSpreadFragmentRefs, ExtractSectionSpreadResults, OmitPartialSpreadKeys, OmitSectionSpreadKeys } from './masking'
import type { TypedScalarSelection, TypedSelectionSet } from './selection'
import type { Expand, FlatRecord, IntersectionAvoidEmpty, MayBePartial, ParseOutputModifier, Trim, Typename, UnionToIntersection, Values } from './utils'

export type ParseSelection<
  T extends BaseType<any, any> | undefined,
  Selection,
> = T extends BaseType<any, any>
  ? Expand<
    T extends BaseScalar<any, infer Output, any>
      ? Selection extends true
        ? Output
        : never
      : T extends BaseObject<any, any, any>
        ? Selection extends Array<any>
          ? ParseObjectSelection<T, Selection>
          : never
        : never
  >
  : never

export type ParseObjectSelection<
  T extends BaseObject<any, any, any>,
  Selection extends Array<any>,
> = ParseObjectSelectionContext<T, AnalyzedObjectSelection<Selection>>

export type ParseObjectSelectionContext<
  T extends BaseObject<any, any, any>,
  Context,
> = Context extends Record<string, any>
  ? _ParseObjectSelectionContextCore<
      T,
      OmitPartialSpreadKeys<OmitSectionSpreadKeys<Context>>
    > & ExtractPartialSpreadFragmentRefs<Context> & ExtractSectionSpreadResults<Context>
  : never

// Internal: handles field and inline fragment parsing on the cleaned context
// (after partial spread keys have been stripped by the public ParseObjectSelectionContext).
type _ParseObjectSelectionContextCore<
  T extends BaseObject<any, any, any>,
  Context,
> = Context extends Record<string, any>
  ? Extract<keyof Context, `... on ${string}` | '...'> extends never
    ? ParseObjectSelectionContextFields<T, Context>
    : IntersectionAvoidEmpty<
      ParseObjectSelectionContextFields<T, OmitInlineFragmentKeys<Context>>,
      ParseObjectSelectionContextInlineFragments<T, PickInlineFragmentKeys<Context>>
    >
  : never

type PickInlineFragmentKeys<T> = {
  [K in keyof T as K extends '...' | `... on ${string}` ? K : never]: T[K]
}
type OmitInlineFragmentKeys<T> = {
  [K in keyof T as K extends '...' | `... on ${string}` ? never : K]: T[K]
}

export type ParseObjectSelectionContextFields<
  T extends BaseObject<any, any, any>,
  SelectionObject extends Record<string, any>,
> = T extends BaseObject<any, infer Fields, any>
  ? {
      [K in keyof SelectionObject as ParseSelectionName<K & string>['Name']]:
      ParseSelectionName<K & string>['Field'] extends '__typename'
        ? Typename<T>
        : ParseObjectSelectionContextField<Fields[ParseSelectionName<K & string>['Field']], SelectionObject[K]>
    }
  : never

export type ParseObjectSelectionContextField<
  T extends Field<any, any, any>,
  Selection,
> = T extends Field<infer Modifier, infer Type, any>
  ? Selection extends (...args: any) => TypedSelectionSet<infer Result, infer IsOptional>
    ? true extends IsOptional
      ? ParseOutputModifier<Modifier, Type, Result> | null | undefined
      : ParseOutputModifier<Modifier, Type, Result>
    : Selection extends (...args: any) => TypedScalarSelection<infer IsOptional>
      ? true extends IsOptional
        ? ParseOutputModifier<Modifier, Type, ParseSelection<Type, true>> | null | undefined
        : ParseOutputModifier<Modifier, Type, ParseSelection<Type, true>>
      : ParseOutputModifier<Modifier, Type, ParseSelection<Type, Selection>>
  : never

export type ParseSelectionName<T extends string>
  = T extends `${infer Name}:${infer Field}`
    ? { Field: Trim<Field>, Name: Name }
    : { Field: T, Name: T }

export type ParseObjectSelectionContextInlineFragments<
  T extends BaseObject<any, any, any>,
  SelectionObject extends Record<string, any>,
> = T extends BaseObject<any, any, infer Implements>
  ? Implements extends Record<string, never>
    ? '...' extends keyof SelectionObject
      ? ParseInlineFragmentReturn<T, SelectionObject['...']>
      : never
    : Values<{
      [K in ('...' | `... on ${string & keyof Implements}`)]: K extends '...'
        ? K extends keyof SelectionObject
          ? ParseInlineFragmentReturn<T, SelectionObject['...']>
          : never
        : K extends `... on ${infer Type}`
          ? { __typename?: Typename<T> } & ParseInlineFragmentReturn<Implements[Type], SelectionObject[K]>
          : never
    }>
  : never

export type ParseInlineFragmentReturn<
  _T extends BaseObject<any, any, any>,
  SelectionField,
> = SelectionField extends (...args: any) => TypedSelectionSet<infer Result, infer IsOptional>
  ? true extends IsOptional
    ? MayBePartial<Result>
    : Result
  : never

export type AnalyzedObjectSelection<Selection>
  = FlatRecord<UnionToIntersection<
    Selection extends Array<infer Items>
      ? Items extends string
        ? { [K in Items]: true }
        : Items extends Record<string, any>
          ? Items
          : never
      : never
  >>
