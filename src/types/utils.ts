import type { Input } from '../runtime/define'
import type { ModifierToType, RequireInput } from '../runtime/utils'
import type { TypedGazania } from './builder'

// Most of the type-level helpers now live in src/runtime/utils.ts. Only
// SchemaRequire remains here because it depends on TypedGazania (builder layer),
// which has not been merged yet. It will move once the builder layer is merged.

/**
 * Resolve a GraphQL modifier string against a schema-bearing gazania instance
 * to the required input type. Used by the variable-validation layer.
 */
export type SchemaRequire<Gazania extends TypedGazania<any>, Modifier extends string>
  = Gazania extends TypedGazania<infer Schema>
    ? RequireInput<Input<ModifierToType<Schema, Modifier>>>
    : never

export type {
  BaseOf,
  DefaultSpaces,
  Expand,
  FindType,
  FlatRecord,
  IntersectionAvoidEmpty,
  MayBePartial,
  ModifiedName,
  ModifierToType,
  RelaxedOptional,
  RequireInput,
  RequireInputOrVariable,
  Trim,
  TrimAfter,
  TrimBefore,
  Typename,
  TypenameField,
  UnionToIntersection,
  Values,
  WrapFieldResult,
} from '../runtime/utils'
export type { Exact } from '../runtime/utils'
