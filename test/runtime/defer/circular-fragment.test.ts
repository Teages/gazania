import { print } from 'graphql'
import { describe, expect, it } from 'vitest'

/**
 * Reproduces the circular import bug where a Gazania fragment becomes undefined.
 *
 * Bug scenario (mirrors the original report):
 *   contact-info.ts (component) imports `useResearcher` from use-researcher.ts
 *   use-researcher.ts (composable) imports `ResearcherContactInfoPage_ResearcherPartial`
 *     from contact-info.ts to build ContactInfoQuery
 *
 * When contact-info.ts is the entry point (e.g. a page component is loaded first),
 * it triggers use-researcher.ts evaluation while contact-info.ts is still being
 * evaluated. At that moment ResearcherContactInfoPage_ResearcherPartial is not yet
 * initialized, so the spread `...ResearcherContactInfoPage_ResearcherPartial(vars)`
 * inside .select() throws TypeError, and ContactInfoQuery is never created.
 */
describe('runtime: regression test for circular imports that no longer break fragment and query construction', () => {
  it('ensures circular import order preserves the fragment definition in ContactInfoQuery', async () => {
    // Import contact-info.ts first to replicate the real-world entry-point order
    // (the Vue component / page is what triggers the circular dependency chain):
    //
    //   contact-info.ts  →  use-researcher.ts  →  contact-info.ts  (cycle)
    //
    // When use-researcher.ts evaluates inside this chain,
    // ResearcherContactInfoPage_ResearcherPartial from contact-info.ts is still
    // undefined → TypeError thrown inside .select() → module load fails.
    const { ContactInfoQuery } = await import('./fixtures/contact-info')
      .then(() => import('./fixtures/use-researcher'))

    // ContactInfoQuery should be a valid DocumentNode containing the fragment spread.
    // The regression is fixed if both modules import successfully and
    // the constructed query still includes the expected fragment.
    expect(print(ContactInfoQuery)).toContain('ResearcherContactInfoPage_Researcher')
  })
})
