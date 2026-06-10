import type { Input } from './define'
import type { ModifierToType, RelaxedOptional, RequireInput } from './utils'

declare const VariableIdentitySymbol: unique symbol

export type AnyVariables = Record<string, Variable<string>>

export interface Variable<T extends string> {
  [VariableIdentitySymbol]?: () => T
}

declare const VariableDefResultSymbol: unique symbol

export interface VariableDefResult<T = unknown> {
  [VariableDefResultSymbol]?: () => T
}

export type VariablesDefinitionDollarPackage<T extends string>
  = ($: VariablesDefinitionDollar) => VariableDefResult<T>

export interface VariablesDefinitionDollar {
  <T extends string>(def: T): VariableDefResult<T>
}

export type VariablesDefinition<T extends string>
  = Record<string, T | VariablesDefinitionDollarPackage<T>>

export type PrepareVariables<T extends VariablesDefinition<string>> = {
  [K in keyof T]: UnpackDollar<T[K]> extends `${infer Type} = ${infer _Default}`
    ? Variable<Type>
    : Variable<UnpackDollar<T[K]>>
}

type UnpackDollar<T>
  = T extends (($: VariablesDefinitionDollar) => VariableDefResult<infer U extends string>)
    ? U
    : T

export type AcceptVariable<Modifier extends string>
  = | Variable<Modifier>
    | AcceptVariableAsNull<Modifier>
    | AcceptVariableAsCompatibleList<Modifier>

type AcceptVariableAsNull<Modifier extends string>
  = Modifier extends `${string}!`
    ? never
    : Variable<`${Modifier}!`>

// GraphQL §5.8.5: variable types must be lists when the argument expects a list.
// Only list-to-list nullability widening is allowed — not scalar-to-list (§3.11 is literals only).
type AcceptVariableAsCompatibleList<Modifier extends string>
  = Modifier extends `[${infer Inner}!]!`
    ? never
    : Modifier extends `[${infer Inner}]!`
      ? WrapOuterListVariants<Inner, true, true>
      : Modifier extends `[${infer Inner}!]`
        ? WrapOuterListVariants<Inner, true, true>
        : Modifier extends `[${infer Inner}]`
          ? | WrapOuterListVariants<Inner, true, false>
            | WrapOuterListVariants<Inner, true, true>
            | WrapOuterListVariants<Inner, false, true>
          : never

type ModifierStrings<T> = T extends Variable<infer M extends string> ? M : never

type FormatListModifier<Inner extends string, ListNonNull extends boolean>
  = ListNonNull extends true ? `[${Inner}]!` : `[${Inner}]`

type CompatibleInnersForListItem<Inner extends string, ItemNonNull extends boolean>
  = Inner extends `[${string}`
    ? Inner | ModifierStrings<AcceptVariableAsCompatibleList<Inner>>
    : ItemNonNull extends true
      ? Inner extends `${string}!` ? Inner : `${Inner}!`
      : Inner

type WrapOuterListVariants<Inner extends string, ItemNonNull extends boolean, ListNonNull extends boolean>
  = CompatibleInnersForListItem<Inner, ItemNonNull> extends infer I extends string
    ? Variable<FormatListModifier<I, ListNonNull>>
    : never

export type RequireVariables<Schema, T extends VariablesDefinition<string>> = RelaxedOptional<{
  [K in keyof T]: UnpackDollar<T[K]> extends `${infer Modifier} = ${infer _Default}`
    ? RequireVariable<Schema, Modifier> extends never
      ? never
      : RequireVariable<Schema, Modifier> | undefined
    : RequireVariable<Schema, UnpackDollar<T[K]>>
}>

type RequireVariable<Schema, Modifier extends string>
  = RequireInput<Input<ModifierToType<Schema, Modifier>>>
