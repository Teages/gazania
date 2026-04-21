import type { Input } from './define'
import type { RelaxedOptional, RequireInputOrVariable } from './utils'

export type Argument = Record<string, unknown>

export type PrepareSelectionArgument<
  T extends Record<string, Input<any>>,
> = RelaxedOptional<{
  [K in keyof T]: RequireInputOrVariable<T[K]>
}>
