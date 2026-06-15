/**
 * Shim: type-level utility helpers now live in `src/runtime/utils.ts`.
 * Re-export kept so existing imports resolve during the merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
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
  SchemaRequire,
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
