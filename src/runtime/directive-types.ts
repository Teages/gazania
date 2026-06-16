import type { Argument } from './argument-types'
import type { DirectiveDollar } from './dollar-types'
import type { AnyVariables } from './variable-types'

// Type-level directive helpers used by the
// schema-aware dollar layer. Kept separate from src/runtime/directive.ts
// (the runtime parseDirectives value helper) because the typed DirectiveInput
// here pairs Argument (typed) with the def, while the runtime DirectiveInput
// pairs ArgumentMap (runtime) — same shape, distinct module roles.

export type DirectiveInput = [
  def: `@${string}`,
  argument: Argument,
]

export type HasSkipDirective<Input extends Array<DirectiveInput>>
  = Input extends Array<[infer Name, infer _Args]>
    ? `@${string}` extends Name
      ? false
      : '@skip' extends Name
        ? true
        : '@include' extends Name
          ? true
          : false
    : false

export type DirectivesInputWithDollar<Variables>
  = Variables extends AnyVariables
    ? ($: DirectiveDollar<Variables>) => Array<DirectiveInput>
    : never
