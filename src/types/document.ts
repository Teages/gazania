/**
 * Shim: TypedDocumentNode / ResultOf / VariablesOf now live in
 * `src/runtime/document.ts`. Kept as a re-export so existing imports from
 * `src/types/document` continue to resolve during the incremental merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type { ResultOf, TypedDocumentNode, VariablesOf } from '../runtime/document'
