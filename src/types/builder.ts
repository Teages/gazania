import type { BaseObject, DefineSchema } from './define'
import type { DirectiveInput } from './directive'
import type { TypedDocumentNode } from './document'
import type { RootDollar, TypedSelectionSet } from './dollar'
import type { EnumFunction } from './enum'
import type { FragmentOf, FragmentRef, TypedPartialSpreadReturn, TypedSectionSpreadReturn } from './masking'
import type { Expand } from './utils'
import type { AnyVariables, PrepareVariables, RequireVariables, VariablesDefinition } from './variable'

export type OperationTypeObject<
  Schema extends DefineSchema<any>,
  Type extends string,
> = Schema extends DefineSchema<infer Namespace>
  ? Type extends keyof Namespace
    ? Namespace[Type]
    : never
  : never

export interface TypedOperationBuilderWithoutVars<
  Schema extends DefineSchema<any>,
  OpType extends BaseObject<any, any, any>,
> {
  vars: <const V extends VariablesDefinition<string>>(
    defs: V,
  ) => TypedOperationBuilderWithVars<Schema, OpType, V>

  directives: (
    fn: () => DirectiveInput[],
  ) => TypedOperationBuilderWithoutVars<Schema, OpType>

  select: <Result>(
    callback: ($: RootDollar<OpType>) => TypedSelectionSet<Result>,
  ) => TypedDocumentNode<
    Expand<Result>,
    Record<string, never>
  >
}

export interface TypedOperationBuilderWithVars<
  Schema extends DefineSchema<any>,
  OpType extends BaseObject<any, any, any>,
  V extends VariablesDefinition<string>,
> {
  directives: (
    fn: (vars: PrepareVariables<V>) => DirectiveInput[],
  ) => TypedOperationBuilderWithVars<Schema, OpType, V>

  select: <Result>(
    callback: (
      $: RootDollar<OpType>,
      vars: PrepareVariables<V>,
    ) => TypedSelectionSet<Result>,
  ) => TypedDocumentNode<
    Expand<Result>,
    RequireVariables<Schema, V>
  >
}

export type FragmentBase<Schema extends DefineSchema<any>>
  = Schema extends DefineSchema<infer Namespace>
    ? { [K in keyof Namespace as Namespace[K] extends BaseObject<any, any, any> ? K : never]: Namespace[K] }
    : never

export interface TypedFragmentBuilder<Schema extends DefineSchema<any>> {
  on: <Type extends string & keyof FragmentBase<Schema>>(
    typeName: Type,
  ) => TypedFragmentBuilderOnType<Schema, FragmentBase<Schema>[Type]>
}

export interface TypedFragmentBuilderOnType<
  Schema extends DefineSchema<any>,
  T extends BaseObject<any, any, any>,
> {
  vars: <const V extends VariablesDefinition<string>>(
    defs: V,
  ) => TypedFragmentBuilderOnTypeWithVar<Schema, T, V>

  directives: (
    fn: () => DirectiveInput[],
  ) => TypedFragmentBuilderOnType<Schema, T>

  select: <Result>(
    callback: ($: RootDollar<T>) => TypedSelectionSet<Result>,
  ) => TypedDocumentNode<
    Expand<Result>,
    Record<string, any>
  >
}

export interface TypedFragmentBuilderOnTypeWithVar<
  Schema extends DefineSchema<any>,
  T extends BaseObject<any, any, any>,
  V extends VariablesDefinition<string>,
> {
  directives: (
    fn: (vars: PrepareVariables<V>) => DirectiveInput[],
  ) => TypedFragmentBuilderOnTypeWithVar<Schema, T, V>

  select: <Result>(
    callback: (
      $: RootDollar<T>,
      vars: PrepareVariables<V>,
    ) => TypedSelectionSet<Result>,
  ) => TypedDocumentNode<
    Expand<Result>,
    RequireVariables<Schema, V>
  >
}

export interface TypedPartialBuilder<
  Schema extends DefineSchema<any>,
  Name extends string = string,
> {
  on: <Type extends string & keyof FragmentBase<Schema>>(
    typeName: Type,
  ) => TypedPartialBuilderOnType<Schema, FragmentBase<Schema>[Type], Name>
}

export interface TypedSectionBuilder<
  Schema extends DefineSchema<any>,
  Name extends string = string,
> {
  on: <Type extends string & keyof FragmentBase<Schema>>(
    typeName: Type,
  ) => TypedSectionBuilderOnType<Schema, FragmentBase<Schema>[Type], Name>
}

export interface TypedSectionBuilderOnType<
  Schema extends DefineSchema<any>,
  T extends BaseObject<any, any, any>,
  Name extends string = string,
> {
  vars: <const V extends VariablesDefinition<string>>(
    defs: V,
  ) => TypedSectionBuilderOnTypeWithVar<Schema, T, V, Name>

  directives: (
    fn: () => DirectiveInput[],
  ) => TypedSectionBuilderOnType<Schema, T, Name>

  select: <Result>(
    callback: ($: RootDollar<T>) => TypedSelectionSet<Result>,
  ) => TypedSectionPackage<T, Result, AnyVariables, Name>
}

export interface TypedSectionBuilderOnTypeWithVar<
  _Schema extends DefineSchema<any>,
  T extends BaseObject<any, any, any>,
  V extends VariablesDefinition<string>,
  Name extends string = string,
> {
  directives: (
    fn: (vars: PrepareVariables<V>) => DirectiveInput[],
  ) => TypedSectionBuilderOnTypeWithVar<_Schema, T, V, Name>

  select: <Result>(
    callback: ($: RootDollar<T>, vars: PrepareVariables<V>) => TypedSelectionSet<Result>,
  ) => TypedSectionPackage<T, Result, PrepareVariables<V>, Name>
}

export interface TypedPartialBuilderOnType<
  Schema extends DefineSchema<any>,
  T extends BaseObject<any, any, any>,
  Name extends string = string,
> {
  vars: <const V extends VariablesDefinition<string>>(
    defs: V,
  ) => TypedPartialBuilderOnTypeWithVar<Schema, T, V, Name>

  directives: (
    fn: () => DirectiveInput[],
  ) => TypedPartialBuilderOnType<Schema, T, Name>

  select: <Result>(
    callback: ($: RootDollar<T>) => TypedSelectionSet<Result>,
  ) => TypedPartialPackage<T, Result, AnyVariables, Name>
}

export interface TypedPartialBuilderOnTypeWithVar<
  _Schema extends DefineSchema<any>,
  T extends BaseObject<any, any, any>,
  V extends VariablesDefinition<string>,
  Name extends string = string,
> {
  directives: (
    fn: (vars: PrepareVariables<V>) => DirectiveInput[],
  ) => TypedPartialBuilderOnTypeWithVar<_Schema, T, V, Name>

  select: <Result>(
    callback: (
      $: RootDollar<T>,
      vars: PrepareVariables<V>,
    ) => TypedSelectionSet<Result>,
  ) => TypedPartialPackage<T, Result, PrepareVariables<V>, Name>
}

export interface TypedPartialPackage<
  _T extends BaseObject<string, any, any>,
  _P,
  _Variables extends AnyVariables,
  _Name extends string = string,
> {
  (vars: _Variables, directives?: DirectiveInput[]): TypedPartialSpreadReturn<_T, _Name>

  /** Phantom key used by `FragmentOf<T>` to extract the fragment ref type. */
  readonly ' $fragmentOf'?: _T extends BaseObject<infer TypeName, any, any>
    ? FragmentRef<_Name, TypeName>
    : never
}

export interface TypedSectionPackage<
  _T extends BaseObject<string, any, any>,
  _P,
  _Variables extends AnyVariables,
  _Name extends string = string,
> {
  (vars: _Variables, directives?: DirectiveInput[]): TypedSectionSpreadReturn<Expand<_P>, _Name>
}

export type RequireOperationPartialData<
  T extends TypedPartialPackage<any, any, any, any>,
> = T extends TypedPartialPackage<any, infer Result, any, any>
  ? Expand<Result>
  : never

export type ResultOfSection<T> = T extends TypedSectionPackage<any, infer Result, any, any>
  ? Expand<Result>
  : never

/**
 * Typed signature for `readFragment`.
 * Narrows the opaque `FragmentRef` from a partial spread back to the concrete result type.
 * The runtime implementation is an identity function.
 */
export interface ReadFragmentFn {
  /** Unmask a non-nullable single fragment ref. */
  <T extends TypedPartialPackage<any, any, any, any>>(
    partial: T,
    data: FragmentOf<T>,
  ): RequireOperationPartialData<T>

  /** Unmask a nullable fragment ref, preserving null/undefined. */
  <T extends TypedPartialPackage<any, any, any, any>>(
    partial: T,
    data: FragmentOf<T> | null | undefined,
  ): RequireOperationPartialData<T> | null | undefined

  /** Unmask a readonly array of non-nullable fragment refs. */
  <T extends TypedPartialPackage<any, any, any, any>>(
    partial: T,
    data: ReadonlyArray<FragmentOf<T>>,
  ): ReadonlyArray<RequireOperationPartialData<T>>

  /** Unmask a readonly array that may contain null/undefined items. */
  <T extends TypedPartialPackage<any, any, any, any>>(
    partial: T,
    data: ReadonlyArray<FragmentOf<T> | null | undefined>,
  ): ReadonlyArray<RequireOperationPartialData<T> | null | undefined>
}

export interface TypedGazania<Schema extends DefineSchema<any>> {
  query: (name?: string) => TypedOperationBuilderWithoutVars<Schema, OperationTypeObject<Schema, 'Query'>>
  mutation: (name?: string) => TypedOperationBuilderWithoutVars<Schema, OperationTypeObject<Schema, 'Mutation'>>
  subscription: (name?: string) => TypedOperationBuilderWithoutVars<Schema, OperationTypeObject<Schema, 'Subscription'>>
  fragment: (name: string) => TypedFragmentBuilder<Schema>
  partial: <Name extends string>(name: Name) => TypedPartialBuilder<Schema, Name>
  section: <Name extends string>(name: Name) => TypedSectionBuilder<Schema, Name>
  enum: EnumFunction
}
