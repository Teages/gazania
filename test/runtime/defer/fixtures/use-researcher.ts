import { gazania } from '../../../../src'

// Simulates: useResearcher.ts (a Nuxt composable)
// This composable imports the fragment from contact-info.ts to build a query.
// contact-info.ts in turn imports this composable → circular dependency.
import { ResearcherContactInfoPage_ResearcherPartial } from './contact-info'

// When contact-info.ts is the first module to be loaded (e.g. the page component),
// it imports this file while still evaluating itself.
// At that point ResearcherContactInfoPage_ResearcherPartial is not yet initialized,
// so calling it inside .select() throws: "ResearcherContactInfoPage_ResearcherPartial is not a function".
export const ContactInfoQuery = gazania.query('ContactInfo')
  .select(($, vars) => $.select([{
    researcher: $ => $.select([
      ...ResearcherContactInfoPage_ResearcherPartial(vars),
    ]),
  }]))

export function useResearcher() {
  let res: boolean | null = null

  const request = async () => {
    return await new Promise<boolean>((resolve) => {
      const _query = ContactInfoQuery
      setTimeout(() => {
        resolve(true)
      }, 100) // Simulate async request
    })
  }

  request().then(result => res = result)

  return { getRes: () => res }
}
