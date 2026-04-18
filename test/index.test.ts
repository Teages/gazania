import { print } from 'graphql'
import { describe, expect, it } from 'vitest'
import { gazania } from '../src'

describe('gazania runtime', () => {
  describe('simple query', () => {
    it('query with no name and no variables', () => {
      const doc = gazania.query()
        .select($ => $.select([{
          hello: $ => $.args({ name: 'world' }),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "{
          hello(name: "world")
        }"
      `)
    })

    it('query with string shorthand fields', () => {
      const doc = gazania.query()
        .select($ => $.select(['field1', 'field2']))

      expect(print(doc)).toMatchInlineSnapshot(`
        "{
          field1
          field2
        }"
      `)
    })

    it('named query', () => {
      const doc = gazania.query('FetchData')
        .select($ => $.select(['id', 'name']))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query FetchData {
          id
          name
        }"
      `)
    })
  })

  describe('variables', () => {
    it('query with variables', () => {
      const doc = gazania.query('FetchAnime')
        .vars({ id: 'Int!' })
        .select(($, vars) => $.select([{
          Media: $ => $.args({ id: vars.id }).select(['id', {
            title: $ => $.select(['romaji', 'english', 'native']),
          }]),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query FetchAnime($id: Int!) {
          Media(id: $id) {
            id
            title {
              romaji
              english
              native
            }
          }
        }"
      `)
    })

    it('variables with default values', () => {
      const doc = gazania.query('FetchAnime')
        .vars({ id: 'Int = 127549' })
        .select(($, vars) => $.select([{
          Media: $ => $.args({ id: vars.id }).select(['id']),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query FetchAnime($id: Int = 127549) {
          Media(id: $id) {
            id
          }
        }"
      `)
    })

    it('variables with string default', () => {
      const doc = gazania.query('Test')
        .vars({ title: 'String = "hello"' })
        .select(($, vars) => $.select([{
          search: $ => $.args({ title: vars.title }),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query Test($title: String = "hello") {
          search(title: $title)
        }"
      `)
    })

    it('variables with enum default', () => {
      const doc = gazania.query('Test')
        .vars({ status: 'PostStatus = PUBLISHED' })
        .select(($, vars) => $.select([{
          posts: $ => $.args({ status: vars.status }).select(['id']),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query Test($status: PostStatus = PUBLISHED) {
          posts(status: $status) {
            id
          }
        }"
      `)
    })

    it('list type variable', () => {
      const doc = gazania.query('Test')
        .vars({ tags: '[String!]!' })
        .select(($, vars) => $.select([{
          search: $ => $.args({ tags: vars.tags }).select(['id']),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query Test($tags: [String!]!) {
          search(tags: $tags) {
            id
          }
        }"
      `)
    })
  })

  describe('enum values', () => {
    it('enum in args via field dollar', () => {
      const doc = gazania.query('FetchAnime')
        .vars({ id: 'Int = 127549' })
        .select(($, vars) => $.select([{
          Media: $ => $.args({ id: vars.id, type: $.enum('ANIME') })
            .select([
              'id',
              {
                title: $ => $.select(['romaji', 'english', 'native']),
              },
            ]),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query FetchAnime($id: Int = 127549) {
          Media(id: $id, type: ANIME) {
            id
            title {
              romaji
              english
              native
            }
          }
        }"
      `)
    })

    it('enum via gazania.enum', () => {
      const doc = gazania.query()
        .select($ => $.select([{
          media: $ => $.args({ type: gazania.enum('ANIME') }).select(['id']),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "{
          media(type: ANIME) {
            id
          }
        }"
      `)
    })
  })

  describe('aliases', () => {
    it('alias string shorthand', () => {
      const doc = gazania.query()
        .select($ => $.select(['myId: id', 'myName: name']))

      expect(print(doc)).toMatchInlineSnapshot(`
        "{
          myId: id
          myName: name
        }"
      `)
    })

    it('alias in object', () => {
      const doc = gazania.query()
        .select($ => $.select([{
          'myUser: user': $ => $.args({ id: 1 }).select(['id', 'name']),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "{
          myUser: user(id: 1) {
            id
            name
          }
        }"
      `)
    })
  })

  describe('inline fragments', () => {
    it('typed inline fragment', () => {
      const doc = gazania.query('Search')
        .vars({ term: 'String!' })
        .select(($, vars) => $.select([{
          search: $ => $.args({ query: vars.term }).select([
            '__typename',
            {
              '... on Post': $ => $.select(['title', 'content']),
              '... on Video': $ => $.select(['title', 'duration']),
            },
          ]),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query Search($term: String!) {
          search(query: $term) {
            __typename
            ... on Post {
              title
              content
            }
            ... on Video {
              title
              duration
            }
          }
        }"
      `)
    })

    it('generic inline fragment (spread)', () => {
      const doc = gazania.query()
        .select($ => $.select([{
          search: $ => $.select([
            '__typename',
            {
              '...': $ => $.select(['id', 'createdAt']),
              '... on Post': $ => $.select(['title']),
            },
          ]),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "{
          search {
            __typename
            ... {
              id
              createdAt
            }
            ... on Post {
              title
            }
          }
        }"
      `)
    })
  })

  describe('directives', () => {
    it('scalar field with @include', () => {
      const doc = gazania.query('Test')
        .vars({ includeEmail: 'Boolean! = false' })
        .select(($, vars) => $.select([
          'id',
          'name',
          {
            email: $ => $.directives(['@include', { if: vars.includeEmail }]),
          },
        ]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query Test($includeEmail: Boolean! = false) {
          id
          name
          email @include(if: $includeEmail)
        }"
      `)
    })

    it('object field with @skip', () => {
      const doc = gazania.query('Test')
        .vars({ hidePosts: 'Boolean! = false' })
        .select(($, vars) => $.select([{
          posts: $ => $.directives(['@skip', { if: vars.hidePosts }])
            .select(['id', 'title']),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query Test($hidePosts: Boolean! = false) {
          posts @skip(if: $hidePosts) {
            id
            title
          }
        }"
      `)
    })

    it('args + directive combined', () => {
      const doc = gazania.query('Test')
        .vars({ name: 'String!', show: 'Boolean!' })
        .select(($, vars) => $.select([{
          greeting: $ => $.args({ name: vars.name })
            .directives(['@include', { if: vars.show }]),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query Test($name: String!, $show: Boolean!) {
          greeting(name: $name) @include(if: $show)
        }"
      `)
    })

    it('operation-level directives', () => {
      const doc = gazania.query('CachedQuery')
        .vars({ maxAge: 'Int!' })
        .directives(vars => [['@cache', { maxAge: vars.maxAge }]])
        .select($ => $.select(['data']))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query CachedQuery($maxAge: Int!) @cache(maxAge: $maxAge) {
          data
        }"
      `)
    })
  })

  describe('mutation', () => {
    it('basic mutation', () => {
      const doc = gazania.mutation('CreateUser')
        .vars({ input: 'CreateUserInput!' })
        .select(($, vars) => $.select([{
          createUser: $ => $.args({ input: vars.input }).select([
            'id',
            'name',
            'email',
          ]),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "mutation CreateUser($input: CreateUserInput!) {
          createUser(input: $input) {
            id
            name
            email
          }
        }"
      `)
    })
  })

  describe('subscription', () => {
    it('basic subscription', () => {
      const doc = gazania.subscription('OnMessage')
        .vars({ channelId: 'ID!' })
        .select(($, vars) => $.select([{
          onMessage: $ => $.args({ channelId: vars.channelId }).select([
            'id',
            'text',
            {
              sender: $ => $.select(['id', 'name']),
            },
          ]),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "subscription OnMessage($channelId: ID!) {
          onMessage(channelId: $channelId) {
            id
            text
            sender {
              id
              name
            }
          }
        }"
      `)
    })
  })

  describe('fragment', () => {
    it('simple fragment', () => {
      const doc = gazania.fragment('UserFields')
        .on('User')
        .select($ => $.select(['id', 'name', 'email']))

      expect(print(doc)).toMatchInlineSnapshot(`
        "fragment UserFields on User {
          id
          name
          email
        }"
      `)
    })

    it('fragment with variables', () => {
      const doc = gazania.fragment('UserFields')
        .on('User')
        .vars({ includeEmail: 'Boolean!' })
        .select(($, vars) => $.select([
          'id',
          'name',
          {
            email: $ => $.directives(['@include', { if: vars.includeEmail }]),
          },
        ]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "fragment UserFields on User {
          id
          name
          email @include(if: $includeEmail)
        }"
      `)
    })
  })

  describe('partial', () => {
    it('basic partial usage', () => {
      const userPartial = gazania.partial('UserFields')
        .on('User')
        .select($ => $.select(['id', 'name', 'email']))

      const doc = gazania.query('GetUser')
        .vars({ id: 'ID!' })
        .select(($, vars) => $.select([{
          user: $ => $.args({ id: vars.id }).select([
            ...userPartial($),
            '__typename',
          ]),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query GetUser($id: ID!) {
          user(id: $id) {
            ...UserFields
            __typename
          }
        }

        fragment UserFields on User {
          id
          name
          email
        }"
      `)
    })
  })

  describe('complex example (AniList)', () => {
    it('full AniList-style query', () => {
      const doc = gazania.query('FetchAnime')
        .vars({ id: 'Int = 127549' })
        .select(($, vars) => $.select([{
          Media: $ => $.args({ id: vars.id, type: $.enum('ANIME') })
            .select([
              'id',
              {
                title: $ => $.select(['romaji', 'english', 'native']),
              },
            ]),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query FetchAnime($id: Int = 127549) {
          Media(id: $id, type: ANIME) {
            id
            title {
              romaji
              english
              native
            }
          }
        }"
      `)
    })
  })

  describe('directive combination', () => {
    it('dashboard-style query with multiple directives', () => {
      const doc = gazania.query('Dashboard')
        .vars({
          userId: 'ID!',
          includeEmail: 'Boolean! = false',
          hidePosts: 'Boolean! = false',
        })
        .select(($, vars) => $.select([{
          user: $ => $.args({ id: vars.userId }).select([
            'id',
            'name',
            {
              email: $ => $.directives(['@include', { if: vars.includeEmail }]),
              posts: $ => $.directives(['@skip', { if: vars.hidePosts }])
                .select(['id', 'title']),
            },
          ]),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "query Dashboard($userId: ID!, $includeEmail: Boolean! = false, $hidePosts: Boolean! = false) {
          user(id: $userId) {
            id
            name
            email @include(if: $includeEmail)
            posts @skip(if: $hidePosts) {
              id
              title
            }
          }
        }"
      `)
    })
  })

  describe('argument types', () => {
    it('handles various argument value types', () => {
      const doc = gazania.query()
        .select($ => $.select([{
          field: $ => $.args({
            str: 'hello',
            int: 42,
            float: 3.14,
            bool: true,
            nil: null,
            list: [1, 2, 3],
            obj: { key: 'value', nested: { a: 1 } },
          }),
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "{
          field(
            str: "hello"
            int: 42
            float: 3.14
            bool: true
            nil: null
            list: [1, 2, 3]
            obj: {key: "value", nested: {a: 1}}
          )
        }"
      `)
    })
  })

  describe('scalar field dollar', () => {
    it('scalar field: $ => $ (identity return)', () => {
      const doc = gazania.query()
        .select($ => $.select([{
          fieldName: $ => $,
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "{
          fieldName
        }"
      `)
    })

    it('scalar field: true shorthand', () => {
      const doc = gazania.query()
        .select($ => $.select([{
          fieldName: true,
        }]))

      expect(print(doc)).toMatchInlineSnapshot(`
        "{
          fieldName
        }"
      `)
    })
  })
})
