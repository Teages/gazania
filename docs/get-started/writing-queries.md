# Writing queries

Building GraphQL queries with Gazania's builder API.

## Simple query

The most basic query selects scalar fields from the root query type:

```ts
const simpleQuery = gazania.query('SimpleQuery')
  .select($ => $.select(['hello', '__typename']))
```

This produces:

```graphql
query SimpleQuery {
  hello
  __typename
}
```

## Nested object selections

To select fields from object types, use an object in the selection array with a callback:

```ts
const usersQuery = gazania.query('GetUsers')
  .select($ => $.select([{
    users: $ => $.select(['id', 'name', 'email', {
      friends: f => f.select(['id', 'name']),
    }]),
  }]))
```

This produces:

```graphql
query GetUsers {
  users {
    id
    name
    email
    friends {
      id
      name
    }
  }
}
```

### Selection syntax

Selections are arrays that can contain:

- **Strings** — Select a scalar field by name (e.g., `'id'`, `'name'`)
- **Objects** — Select fields with nested selections or callbacks:
  - `{ fieldName: $ => $.select([...]) }` — Object field with nested selection
  - `{ fieldName: $ => $.args({...}) }` — Scalar field with arguments

## Query variables

Declare variables with `.vars()` and reference them in selections:

```ts
const queryWithVars = gazania.query('HelloWithName')
  .vars({ name: 'String = "world"' })
  .select(($, vars) => $.select([{
    hello: $ => $.args({ name: vars.name }),
  }]))
```

This produces:

```graphql
query HelloWithName($name: String = "world") {
  hello(name: $name)
}
```

Variable type strings follow the GraphQL type syntax:

| Type String | GraphQL Type | TypeScript Type |
|---|---|---|
| `'String'` | `String` | `string \| null \| undefined` |
| `'String!'` | `String!` | `string` |
| `'[String!]!'` | `[String!]!` | `string[]` |
| `'Int = 42'` | `Int = 42` | `number \| null \| undefined` |

## Field arguments

Pass arguments to fields with `.args()`:

```ts
const sayingQuery = gazania.query('GetSaying')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    saying: $ => $.args({ id: vars.id }).select([
      'id',
      'content',
      'category',
      {
        owner: o => o.select(['id', 'name']),
      },
    ]),
  }]))
```

Arguments can be:
- **Variables**: references to declared query variables (`vars.id`)
- **Literal values**: inline values (`{ limit: 10 }`)
- **Enum values**: from `gazania.enum()` (`gazania.enum('ACTIVE')` or `() => 'ACTIVE'`)
- **Nested objects**: for input types (`{ input: { name: vars.name } }`)

## Enum values

Use `gazania.enum()` to create typed enum values for arguments:

```ts
const sayingsQuery = gazania.query('GetSayings')
  .select($ => $.select([{
    sayings: $ => $.args({ category: gazania.enum('funny') }).select([
      'id',
      'content',
    ]),
  }]))
```

## Mutations

Mutations work exactly like queries, using `gazania.mutation()`:

```ts
const addSaying = gazania.mutation('AddSaying')
  .vars({ ownerId: 'Int!', content: 'String!', category: 'CategoryEnum!' })
  .select(($, vars) => $.select([{
    addSaying: $ => $.args({
      ownerId: vars.ownerId,
      input: {
        content: vars.content,
        category: vars.category,
      },
    }).select(['id', 'content', 'category']),
  }]))
```

## Subscriptions

Subscriptions also follow the same pattern, using `gazania.subscription()`:

```ts
const countdown = gazania.subscription('Countdown')
  .vars({ from: 'Int!' })
  .select(($, vars) => $.select([{
    countdown: $ => $.args({ from: vars.from }),
  }]))
```

## Aliases

Use the `'alias: fieldName'` syntax to create field aliases:

```ts
const aliasQuery = gazania.query('AliasQuery')
  .select($ => $.select([{
    'myHello: hello': $ => $.args({ name: 'test' }),
  }]))
```

This produces:

```graphql
query AliasQuery {
  myHello: hello(name: "test")
}
```

## Directives

## Field directives

Use `.directives()` on field dollars to add directives:

```ts
const skipQuery = gazania.query('SkipQuery')
  .select($ => $.select([{
    hello: $ => $.directives(['@skip', { if: true }]),
  }]))
```

This produces:

```graphql
query SkipQuery {
  hello @skip(if: true)
}
```

### Operation directives

Use `.directives()` on the operation builder for operation-level directives:

```ts
const cachedQuery = gazania.query('CachedQuery')
  .directives(() => [['@cached', { ttl: 60 }]])
  .select($ => $.select(['data']))
```

This produces:

```graphql
query CachedQuery @cached(ttl: 60) {
  data
}
```

## Union and interface types

Use inline fragment syntax (`'... on TypeName'`) to handle union and interface types:

```ts
const allQuery = gazania.query('GetAll')
  .select($ => $.select([{
    all: $ => $.select(['__typename', {
      '... on User': u => u.select(['id', 'name']),
      '... on Saying': s => s.select(['id', 'content']),
    }]),
  }]))
```

This produces:

```graphql
query GetAll {
  all {
    __typename
    ... on User {
      id
      name
    }
    ... on Saying {
      id
      content
    }
  }
}
```

## Next steps

- [Typed documents](/guides/typed-documents): Extract result and variable types
- [Selections](/guides/selections): The selection system in detail
- [Fragments & partials](/guides/fragments-and-partials): Reuse selections across queries
