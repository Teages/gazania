import { createClient } from '@teages/oh-my-graphql'
import { createGazania } from 'gazania'
import { ofetch } from 'ofetch'

const API = 'https://graphql-test.teages.xyz/graphql-user-apq'
const client = createClient(API, {
  persistedQueries: { autoRetry: true },
  ofetch: ofetch.create({
    async onRequest({ request, options }) {
      console.log('[fetch request]', request, options)
    },
  }),
})
const gazania = createGazania(API)

/**
 * Fetch all users.
 */
const GetUsersQuery = gazania.query('GetUsers')
  .select($ => $.select([{
    users: $ => $.select(['id', 'name']),
  }]))

const result = await client.request(GetUsersQuery)

console.log(result)
