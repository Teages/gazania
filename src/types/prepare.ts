/**
 * Shim: selection-shape helpers now live in `src/runtime/prepare.ts`.
 * Re-export kept so existing imports resolve during the merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type {
  AliasSpace,
  ObjectSelection,
  ObjectSelectionContext,
  ObjectSelectionOnFields,
  ObjectSelectionOnInlineFragments,
  ObjectSelectionSimple,
  PrepareSelection,
  ScalarSelection,
  SelectionFnOnField,
  SelectionFnOnInlineFragment,
  SelectionOnField,
  SelectionSimplyOnField,
  WithAlias,
} from '../runtime/prepare'
