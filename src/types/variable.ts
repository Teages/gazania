import type { Input } from './define'
import type { FindType, ModifiedName, RelaxedOptional, RequireInput } from './utils'

declare const VariableIdentitySymbol: unique symbol

export type VariableStore = Record<string, Variable<string>>

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
    | AcceptVariableAsSimplifiedList<Modifier>

type AcceptVariableAsNull<Modifier extends string>
  = Modifier extends `${string}!`
    ? never
    : Variable<`${Modifier}!`>

type AcceptVariableAsSimplifiedList<Modifier extends string>
  = Modifier extends `[${infer F}!]!`
    ? Variable<`${AcceptSimplifiedListModifier<F>}!`>
    : Modifier extends `[${infer F}]!`
      ? | Variable<`${AcceptSimplifiedListModifier<F>}!`>
      | Variable<`[${F}!]!`>
      : Modifier extends `[${infer F}!]`
        ? | Variable<`${AcceptSimplifiedListModifier<F>}!`>
        | Variable<AcceptSimplifiedListModifier<F>>
        : Modifier extends `[${infer F}]`
          ? | Variable<`[${F}!]`> | Variable<`[${F}!]!`>
          | Variable<`${AcceptSimplifiedListModifier<F>}!`>
          | Variable<`${AcceptSimplifiedListModifier<F>}`>
          : never

type AcceptSimplifiedListModifier<Modifier extends string>
  = Modifier extends `[${infer F}]`
    ? AcceptSimplifiedListModifier<F>
    : Modifier extends `${infer F}!`
      ? AcceptSimplifiedListModifier<F>
      : Modifier


export type RequireVariables<Schema, T extends VariablesDefinition<string>> = RelaxedOptional<{
  [K in keyof T]: UnpackDollar<T[K]> extends `${infer Modifier} = ${infer _Default}`
    ? RequireVariable<Schema, Modifier> extends never
      ? never
      : RequireVariable<Schema, Modifier> | undefined
    : RequireVariable<Schema, UnpackDollar<T[K]>>
}>

type RequireVariable<Schema, Modifier extends string>
  = RequireInput<Input<Modifier, FindType<Schema, ModifiedName<Modifier>>>>
