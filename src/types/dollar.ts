import type { BaseObject } from './define'
import type { DirectiveInput, HasSkipDirective } from './directive'
import type { EnumFunction } from './enum'
import type { ObjectSelection } from './prepare'
import type { ParseObjectSelection } from './result'
import type { TypedScalarSelection, TypedSelectionSet } from './selection'
import type { AnyVariables } from './variable'

export type { TypedScalarSelection, TypedSelectionSet } from './selection'

/** Shared payload accessible on every dollar (vars + enum). */
export interface DollarPayload<Variables extends AnyVariables> {
  vars: Variables
  enum: EnumFunction
}

export type DirectiveDollar<Variables extends AnyVariables> = DollarPayload<Variables>

/**
 * Dollar for scalar fields. Is itself a `TypedScalarSelection`, so it can be returned
 * directly (e.g. `$ => $`). Pipeline: `.args()` -> `.directives()` (terminal).
 */
export interface ScalarFieldDollar<Output, Args = Record<string, never>>
  extends TypedScalarSelection<false> {
  enum: EnumFunction
  args: Args extends Record<string, never>
    ? never
    : (a: Args) => ScalarFieldDollarAfterArgs<Output>
  directives: <U extends DirectiveInput[]>(...directives: U) =>
  HasSkipDirective<U> extends true
    ? TypedScalarSelection<true>
    : TypedScalarSelection<false>
}

// After .args(): no more args/enum, only directives or return directly.
export interface ScalarFieldDollarAfterArgs<_Output>
  extends TypedScalarSelection<false> {
  directives: <U extends DirectiveInput[]>(...directives: U) =>
  HasSkipDirective<U> extends true
    ? TypedScalarSelection<true>
    : TypedScalarSelection<false>
}

/**
 * Dollar for object fields. Not terminal: must call `.select()` to finish.
 * Pipeline: `.args()` -> `.directives()` -> `.select()` (terminal).
 * The type parameter is the schema type (`BaseObject`), and `.select()`
 * computes the result via `ParseObjectSelection`.
 */
export interface ObjectFieldDollar<Type extends BaseObject<any, any, any>, Args = Record<string, never>> {
  enum: EnumFunction
  args: Args extends Record<string, never>
    ? never
    : (a: Args) => ObjectFieldDollarAfterArgs<Type>
  directives: <U extends DirectiveInput[]>(...directives: U) =>
  HasSkipDirective<U> extends true
    ? ObjectFieldDollarAfterDirective<Type, true>
    : ObjectFieldDollarAfterDirective<Type, false>
  select: <const T extends ObjectSelection<Type>>(selection: [...(T extends any[] ? T : never)]) =>
  TypedSelectionSet<ParseObjectSelection<Type, T>, false>
}

// After .args(): no more args/enum, only directives or select.
export interface ObjectFieldDollarAfterArgs<Type extends BaseObject<any, any, any>> {
  directives: <U extends DirectiveInput[]>(...directives: U) =>
  HasSkipDirective<U> extends true
    ? ObjectFieldDollarAfterDirective<Type, true>
    : ObjectFieldDollarAfterDirective<Type, false>
  select: <const T extends ObjectSelection<Type>>(selection: [...(T extends any[] ? T : never)]) =>
  TypedSelectionSet<ParseObjectSelection<Type, T>, false>
}

// After .directives(): only .select() remains.
export interface ObjectFieldDollarAfterDirective<Type extends BaseObject<any, any, any>, IsOptional extends boolean> {
  select: <const T extends ObjectSelection<Type>>(selection: [...(T extends any[] ? T : never)]) =>
  TypedSelectionSet<ParseObjectSelection<Type, T>, IsOptional>
}

/** The dollar passed to the `.select()` callback at the root level. */
export interface RootDollar<Type extends BaseObject<any, any, any>> {
  readonly enum: EnumFunction
  select: <const T extends ObjectSelection<Type>>(selection: [...(T extends any[] ? T : never)]) =>
  TypedSelectionSet<ParseObjectSelection<Type, T>>
}
