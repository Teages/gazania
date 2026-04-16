import type { BaseObject } from './define'

/**
 * Opaque fragment reference marker that appears in query result types.
 * When a partial is spread into a query, the corresponding position in the
 * result type carries a `FragmentRef` instead of the fragment's actual fields.
 *
 * Use `readFragment()` to unwrap the opaque type and access the fields.
 */
export interface FragmentRef<Name extends string, _TypeName extends string> {
  readonly ' $fragmentRefs'?: {
    [K in Name]: true
  }
}

/**
 * Marker type for partial spread entries in selection arrays.
 *
 * When `TypedPartialPackage` is called and spread, it produces an item
 * of this shape. `AnalyzedObjectSelection` includes it in the flat context,
 * and `ParseObjectSelectionContext` extracts `FragmentRef` from it.
 */
export interface PartialSpreadSelection {
  readonly [key: `$partial:${string}`]: unknown
}

/**
 * Extract the opaque fragment reference type from a partial package.
 * Use this to type component props that receive fragment-masked data.
 *
 * @example
 * ```ts
 * const userPartial = gazania.partial('UserFields')
 *   .on('User')
 *   .select($ => $.select(['id', 'name']))
 *
 * type UserRef = FragmentOf<typeof userPartial>
 * // UserRef = FragmentRef<'UserFields', 'User'>
 *
 * function UserCard(props: { user: FragmentOf<typeof userPartial> }) {
 *   const user = readFragment(userPartial, props.user)
 *   // user: { id: number, name: string }
 * }
 * ```
 */
export type FragmentOf<T>
  = T extends { readonly ' $fragmentOf'?: infer Ref }
    ? Ref
    : never

/**
 * Pick only `$partial:*` keys from a context record.
 */
export type PickPartialSpreadKeys<T> = {
  [K in keyof T as K extends `$partial:${string}` ? K : never]: T[K]
}

/**
 * Omit `$partial:*` keys from a context record.
 */
export type OmitPartialSpreadKeys<T> = {
  [K in keyof T as K extends `$partial:${string}` ? never : K]: T[K]
}

/**
 * Extract and intersect all `FragmentRef` markers from partial spread keys.
 * Returns `unknown` (identity for `&`) when there are no partial spreads.
 */
export type ExtractPartialSpreadFragmentRefs<Context>
  = _CollectFragmentRefs<Context> extends infer U
    ? [U] extends [never]
        ? unknown
        : _FragmentRefsToIntersection<U>
    : unknown

// Collect the values of $partial:* keys
type _CollectFragmentRefs<Context>
  = Context extends Record<string, any>
    ? {
        [K in keyof Context as K extends `$partial:${string}` ? K : never]: Context[K]
      } extends infer Picked
        ? Picked[keyof Picked]
        : never
    : never

// Intersect a union of fragment ref types.
// Uses contravariant inference: given U = A | B,
// (A => void) & (B => void) infers intersection I = A & B.
type _FragmentRefsToIntersection<U>
  = (U extends any ? (x: U) => void : never) extends ((x: infer I) => void) ? I : never

/**
 * Compute the return type of `TypedPartialPackage` callable.
 * Returns a single-element tuple containing a partial spread marker object.
 */
export type TypedPartialSpreadReturn<
  T extends BaseObject<any, any, any>,
  Name extends string,
> = [TypedPartialSpreadEntry<T, Name>]

/**
 * A partial spread entry: an object with key `$partial:${Name}`
 * whose value carries `FragmentRef<Name, TypeName>`.
 */
export type TypedPartialSpreadEntry<
  T extends BaseObject<any, any, any>,
  Name extends string,
> = T extends BaseObject<infer TypeName, any, any>
  ? { readonly [K in `$partial:${Name}`]: FragmentRef<Name, TypeName> }
  : never
