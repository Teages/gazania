/**
 * Shim: schema-aware builder phantom interfaces now live in
 * `src/runtime/builder-types.ts`.
 * Re-export kept so existing imports resolve during the merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type {
  FragmentBase,
  OperationTypeObject,
  ReadFragmentFn,
  RequireOperationPartialData,
  ResultOfSection,
  TypedFragmentBuilder,
  TypedFragmentBuilderOnType,
  TypedFragmentBuilderOnTypeWithVar,
  TypedGazania,
  TypedOperationBuilderWithoutVars,
  TypedOperationBuilderWithVars,
  TypedPartialBuilder,
  TypedPartialBuilderOnType,
  TypedPartialBuilderOnTypeWithVar,
  TypedPartialPackage,
  TypedSectionBuilder,
  TypedSectionBuilderOnType,
  TypedSectionBuilderOnTypeWithVar,
  TypedSectionPackage,
} from '../runtime/builder-types'
