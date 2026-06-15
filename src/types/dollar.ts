/**
 * Shim: schema-aware dollar phantom interfaces now live in
 * `src/runtime/dollar-types.ts`.
 * Re-export kept so existing imports resolve during the merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type {
  DirectiveDollar,
  DollarPayload,
  ObjectFieldDollar,
  ObjectFieldDollarAfterArgs,
  ObjectFieldDollarAfterDirective,
  RootDollar,
  ScalarFieldDollar,
  ScalarFieldDollarAfterArgs,
  TypedScalarSelection,
  TypedSelectionSet,
} from '../runtime/dollar-types'
