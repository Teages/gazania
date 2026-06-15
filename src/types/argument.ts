/**
 * Shim: type-level argument helpers now live in
 * `src/runtime/argument-types.ts` (separate from the runtime value helpers in
 * `src/runtime/argument.ts`). Re-export kept so existing imports resolve.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type { Argument, PrepareSelectionArgument } from '../runtime/argument-types'
