/**
 * Shim: enum types now live in `src/runtime/enum.ts` alongside
 * `createEnumFunction`. Kept as a re-export so existing imports from
 * `src/types/enum` continue to resolve during the incremental merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type { EnumFunction, EnumPackage, PackedEnum } from '../runtime/enum'
