import type { Input } from './define'
import type { RelaxedOptional, RequireInputOrVariable } from './utils'

// Merged from src/types/argument.ts. Type-level argument shape used by the
// schema-aware selection layer. Kept separate from src/runtime/argument.ts
// (which holds the runtime parseArguments/parseValue value helpers) to keep
// the type-only and value-only concerns in distinct modules.

export type Argument = Record<string, unknown>

export type PrepareSelectionArgument<
  T extends Record<string, Input<any>>,
> = RelaxedOptional<{
  [K in keyof T]: RequireInputOrVariable<T[K]>
}>
