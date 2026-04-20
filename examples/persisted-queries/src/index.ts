import { createClient } from '@teages/oh-my-graphql'
import { createGazania } from 'gazania'
import { ofetch } from 'ofetch'
import { UserPartial, UserSection } from './fragments'

const API = 'https://graphql-test.teages.xyz/graphql-user-apq'
export const client = createClient(API, {
  persistedQueries: { autoRetry: true },
  ofetch: ofetch.create({
    async onRequest({ request, options }) {
      console.log('[fetch request]', request, options)
    },
  }),
})
export const gazania = createGazania(API)

/**
 * Fetch all users.
 */
const GetUsersQuery = gazania.query('GetUsers')
  .select($ => $.select([{
    users: $ => $.select(['id', 'name']),
  }]))

const _WithFragmentQuery = gazania.query('GetUsersWithFragment')
  .select($ => $.select([{
    users: $ => $.select([
      ...UserPartial({}),
      ...UserSection({}),
    ]),
  }]))

const result = await client.request(GetUsersQuery)

console.log(result)
