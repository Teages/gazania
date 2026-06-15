/**
 * Shim: result-parsing helpers now live in `src/runtime/result.ts`.
 * Re-export kept so existing imports resolve during the merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type {
  AnalyzedObjectSelection,
  ParseInlineFragmentReturn,
  ParseObjectSelection,
  ParseObjectSelectionContext,
  ParseObjectSelectionContextField,
  ParseObjectSelectionContextFields,
  ParseObjectSelectionContextInlineFragments,
  ParseSelection,
  ParseSelectionName,
} from '../runtime/result'
