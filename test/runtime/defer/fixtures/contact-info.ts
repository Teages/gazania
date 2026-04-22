import { gazania } from '../../../../src'

// Simulates: contact-info.vue (a Vue component / page)
// This component defines its own fragment AND uses the useResearcher composable,
// creating a circular dependency: contact-info → use-researcher → contact-info.
import { useResearcher } from './use-researcher'

export const ResearcherContactInfoPage_ResearcherPartial = gazania.partial('ResearcherContactInfoPage_Researcher')
  .on('Researcher')
  .select($ => $.select(['id', 'name', 'email']))

export function useContactInfoPage() {
  // Simulates calling a Nuxt auto-imported composable inside a component
  return useResearcher()
}
