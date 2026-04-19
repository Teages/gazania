import { createGazania } from 'gazania'

const gazania = createGazania('https://nitro-graphql-tester.pages.dev/graphql-user')

/**
 * Fetch all users.
 */
export const GetUsers = gazania.query('GetUsers')
  .select($ => $.select([{
    users: $ => $.select(['id', 'name']),
  }]))

/**
 * Fetch a single user by ID.
 */
export const GetUser = gazania.query('GetUser')
  .vars({ id: 'ID!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select(['id', 'name']),
  }]))

/**
 * Greet with a custom name.
 */
export const Hello = gazania.query('Hello')
  .vars({ name: 'String' })
  .select(($, vars) => $.select([{
    hello: $ => $.args({ name: vars.name }),
  }]))
