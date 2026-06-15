import type { FragmentBuilder } from './builder/fragment'
import type { PartialBuilder } from './builder/partial'
import type { SectionBuilder } from './builder/section'
import type { DirectiveInput } from './directive-types'
import type { TypedDocumentNode } from './document'
import type { EnumFunction } from './enum'
import type { ParseSelectionName } from './result'
import type { TypedScalarSelection, TypedSelectionSet } from './selection'
import type { Expand, FlatRecord, RelaxedOptional, UnionToIntersection } from './utils'
import type { PrepareVariables, VariableDefResult, VariablesDefinition, VariablesDefinitionDollar } from './variable-types'

// Unknown-schema selection inference.
//
// When no schema is registered, `.select()` still produces a recursively
// shaped result type where every scalar leaf is `unknown` and every object
// field is a nested record built from its sub-selection. This mirrors the
// schema-aware pipeline (`PrepareSelection` + `ParseObjectSelection`) but
// needs no `BaseType`/`DefineSchema`, so `createGazania()` (with no schema)
// can still carry useful structural types on its `TypedDocumentNode`.

// ---------------------------------------------------------------------------
// Field dollars
// ---------------------------------------------------------------------------

/**
 * Dollar handed to every object-field callback in unknown mode.
 *
 * It doubles as a scalar terminal (extends `TypedScalarSelection`, so it can be
 * returned directly for scalar fields) and exposes `.select()` for object
 * fields. The parser (`ParseUnknownFieldValue`) discriminates on the callback's
 * return type to decide whether the field is scalar (`unknown`) or nested
 * (the parsed sub-selection).
 */
export interface UnknownFieldDollar extends TypedScalarSelection<false> {
  readonly enum: EnumFunction
  args: (a: any) => UnknownFieldDollar
  directives: (...directives: any[]) => UnknownFieldDollar
  select: <const T extends UnknownSelectionItem[]>(
    selection: [...(T extends any[] ? T : never)],
  ) => TypedSelectionSet<ParseUnknownSelection<T>, false>
}

/**
 * Dollar passed to the root `.select()` callback in unknown mode.
 * `ObjectFieldDollar`/`RootDollar` require a schema `BaseType`; this is the
 * schema-free equivalent.
 */
export interface UnknownRootDollar {
  readonly enum: EnumFunction
  select: <const T extends UnknownSelectionItem[]>(
    selection: [...(T extends any[] ? T : never)],
  ) => TypedSelectionSet<ParseUnknownSelection<T>, false>
}

// ---------------------------------------------------------------------------
// Selection-shape constraints
// ---------------------------------------------------------------------------

/** A single object-field callback in unknown mode: either scalar or object. */
export type UnknownFieldCallback
  = | (($: UnknownFieldDollar) => TypedScalarSelection<boolean>)
    | (($: UnknownFieldDollar) => TypedSelectionSet<any, boolean>)

/** Object element of an unknown selection array. */
export interface UnknownSelectionObject {
  [key: string]: true | UnknownFieldCallback
}

/** One element of an unknown selection array. */
export type UnknownSelectionItem = string | UnknownSelectionObject

// ---------------------------------------------------------------------------
// Result parser
// ---------------------------------------------------------------------------

/**
 * Collapse a selection array into the merged record form, mirroring
 * `AnalyzedObjectSelection` but kept local so this module has no dependency on
 * schema-bearing result machinery.
 */
type AnalyzedUnknownSelection<Selection>
  = FlatRecord<UnionToIntersection<
    Selection extends Array<infer Items>
      ? Items extends string
        ? { [K in Items]: true }
        : Items extends Record<string, any>
          ? Items
          : never
      : never
  >>

/**
 * Resolve a single field value (the right-hand side of an object entry, or
 * `true` from string shorthand) into its result type.
 *
 * - `true` (scalar shorthand) -> `unknown`
 * - callback returning `TypedSelectionSet<Result>` -> nested object -> `Result`
 * - callback returning `TypedScalarSelection` (incl. the dollar itself) -> `unknown`
 */
type ParseUnknownFieldValue<V>
  = V extends true
    ? unknown
    : V extends (...args: any) => TypedSelectionSet<infer Result, any>
      ? Result
      : V extends (...args: any) => TypedScalarSelection<any>
        ? unknown
        : unknown

/**
 * Recursively parse an unknown selection array into a structural result type.
 * Every scalar leaf collapses to `unknown`; every object field preserves its
 * sub-selection shape. Aliases (`"alias: field"`) are honored.
 */
export type ParseUnknownSelection<Selection extends Array<any>>
  = Expand<{
    [K in keyof AnalyzedUnknownSelection<Selection> as ParseSelectionName<K & string>['Name']]:
    ParseUnknownFieldValue<AnalyzedUnknownSelection<Selection>[K]>
  }>

// ---------------------------------------------------------------------------
// Variables (unknown schema)
// ---------------------------------------------------------------------------

// Unpack a `.vars()` entry that may be a raw modifier string or a
// `($: VariablesDefinitionDollar) => VariableDefResult<T>` callback (the `$`
// helper form) down to its modifier string. Mirrors the unexported
// `UnpackDollar` in `variable-types.ts`.
type UnpackUnknownModifier<T>
  = T extends (($: VariablesDefinitionDollar) => VariableDefResult<infer U extends string>)
    ? U
    : T

/**
 * Schema-agnostic variable shape for unknown mode.
 *
 * Mirrors `RequireVariables`'s key structure and required/optional rules but
 * resolves every value to `unknown` instead of consulting a type registry
 * (which would collapse to `never` with no schema). Rules, matching
 * `RequireVariables`:
 * - `"Type!"` (non-null) -> required `unknown`
 * - `"Type"` (nullable) -> optional `unknown | undefined`
 * - `"Type = default"` (defaulted) -> optional `unknown | undefined`
 */
export type UnknownVariables<V extends VariablesDefinition<string>>
  = RelaxedOptional<{
    [K in keyof V]: UnpackUnknownModifier<V[K]> extends `${infer _Type} = ${infer _Default}`
      ? unknown | undefined
      : UnpackUnknownModifier<V[K]> extends `${string}!`
        ? unknown
        : unknown | undefined
  }>

// ---------------------------------------------------------------------------
// Operation builders (unknown schema)
// ---------------------------------------------------------------------------

export interface UnknownOperationBuilderWithoutVars {
  vars: <const V extends VariablesDefinition<string>>(
    defs: V,
  ) => UnknownOperationBuilderWithVars<V>
  directives: (fn: () => DirectiveInput[]) => UnknownOperationBuilderWithoutVars
  select: <Result>(
    callback: ($: UnknownRootDollar) => TypedSelectionSet<Result>,
  ) => TypedDocumentNode<Expand<Result>, Record<string, never>>
}

export interface UnknownOperationBuilderWithVars<
  V extends VariablesDefinition<string>,
> {
  directives: (
    fn: (vars: PrepareVariables<V>) => DirectiveInput[],
  ) => UnknownOperationBuilderWithVars<V>
  select: <Result>(
    callback: (
      $: UnknownRootDollar,
      vars: PrepareVariables<V>,
    ) => TypedSelectionSet<Result>,
  ) => TypedDocumentNode<Expand<Result>, UnknownVariables<V>>
}

// ---------------------------------------------------------------------------
// Gazania (unknown schema)
// ---------------------------------------------------------------------------

/**
 * The gazania instance type returned by `createGazania()` / `createGazania(url)`
 * when no schema is registered. Operations produce `TypedDocumentNode`s whose
 * `Result` is the unknown selection shape; fragments/partials/sections retain
 * their plain (untyped) builder shapes since they require a type name.
 */
export interface UnknownGazania {
  readonly '~isGazania': true
  'query': (name?: string) => UnknownOperationBuilderWithoutVars
  'mutation': (name?: string) => UnknownOperationBuilderWithoutVars
  'subscription': (name?: string) => UnknownOperationBuilderWithoutVars
  'fragment': (name: string) => FragmentBuilder
  'partial': <const Name extends string>(name: Name) => PartialBuilder<Name>
  'section': <const Name extends string>(name: Name) => SectionBuilder<Name>
  'enum': EnumFunction
}
