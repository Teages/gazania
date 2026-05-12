import { createClient } from '@teages/oh-my-graphql'
import { createGazania } from 'gazania'

export type { FragmentOf } from 'gazania'
export { readFragment } from 'gazania'

const endpoint = 'https://graphql.anilist.co'
export const schema = createGazania(endpoint)

export const client = createClient(endpoint)
