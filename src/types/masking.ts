/**
 * Shim: fragment masking types now live in `src/runtime/masking.ts` alongside
 * the `readFragment` identity function. Kept as a re-export so existing
 * imports from `src/types/masking` continue to resolve during the merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type {
  ExtractPartialSpreadFragmentRefs,
  ExtractSectionSpreadResults,
  FragmentOf,
  FragmentRef,
  OmitPartialSpreadKeys,
  OmitSectionSpreadKeys,
  PartialSpreadSelection,
  PickPartialSpreadKeys,
  PickSectionSpreadKeys,
  TypedPartialSpreadEntry,
  TypedPartialSpreadReturn,
  TypedSectionSpreadEntry,
  TypedSectionSpreadReturn,
} from '../runtime/masking'
