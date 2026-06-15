/**
 * Shim: type-level directive helpers now live in
 * `src/runtime/directive-types.ts` (separate from the runtime value helper
 * `parseDirectives` in `src/runtime/directive.ts`). Re-export kept so existing
 * imports resolve.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type { DirectiveInput, DirectivesInputWithDollar, HasSkipDirective } from '../runtime/directive-types'
