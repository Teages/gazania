/**
 * Shim: phantom selection-set types now live in `src/runtime/selection.ts`
 * alongside `parseSelectionSet`. Kept as a re-export so existing imports from
 * `src/types/selection` continue to resolve during the incremental merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type { TypedScalarSelection, TypedSelectionSet } from '../runtime/selection'
