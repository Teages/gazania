# Fragments & partials

Gazania has two ways to reuse selection sets across queries: fragments and partials.

## Fragments

Fragments define reusable selections on a specific type. They compile to standard GraphQL named fragments.

### Basic fragment

```ts
const userFragment = gazania.fragment('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))
```

This produces:

```graphql
fragment UserFields on User {
  id
  name
  email
}
```

### Fragment results

Extract the result type with `ResultOf`:

```ts
import type { ResultOf } from 'gazania'

type UserFields = ResultOf<typeof userFragment>
// { id: number, name: string, email: string }
```

### Fragments with variables

Fragments can reference variables from the operation they're used in:

```ts
const userFragment = gazania.fragment('UserFields')
  .on('User')
  .vars({ includeEmail: 'Boolean!' })
  .select(($, vars) => $.select([
    'id',
    'name',
    {
      email: $ => $.directives(['@include', { if: vars.includeEmail }]),
    },
  ]))
```

### Fragments with directives

Add directives to the fragment definition itself:

```ts
const userFragment = gazania.fragment('UserFields')
  .on('User')
  .directives(() => [['@deprecated', { reason: 'use NewUserFields' }]])
  .select($ => $.select(['id', 'name']))
```

This produces:

```graphql
fragment UserFields on User @deprecated(reason: "use NewUserFields") {
  id
  name
}
```

When combined with variables, the directive function receives the variable proxies:

```ts
const userFragment = gazania.fragment('UserFields')
  .on('User')
  .vars({ skip: 'Boolean!' })
  .directives(vars => [['@skip', { if: vars.skip }]])
  .select(($, vars) => $.select(['id', 'name']))
```

## Partials

Partials are built on top of fragments. They produce reusable selection "packages" that can be spread into any query on the same type.

### Creating a partial

```ts
const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))
```

### Using partials in queries

Spread a partial into a query's selection using the spread syntax:

```ts
const query = gazania.query('GetUser')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select([
      ...userPartial(vars),
      '__typename',
    ]),
  }]))
```

This produces a query that uses a fragment spread:

```graphql
query GetUser($id: Int!) {
  user(id: $id) {
    ...UserFields
    __typename
  }
}

fragment UserFields on User {
  id
  name
  email
}
```

### Partials with directives

You can pass directives when spreading a partial (applied to the fragment spread site):

```ts
const query = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial($, [['@cached', { ttl: 30 }]]),
    ]),
  }]))
```

This produces:

```graphql
query GetUser {
  user {
    ...UserFields @cached(ttl: 30)
  }
}

fragment UserFields on User {
  id
  name
  email
}
```

To add directives to the fragment definition itself, use `.directives()` on the partial builder:

```ts
const userPartial = gazania.partial('UserFields')
  .on('User')
  .directives(() => [['@deprecated', { reason: 'use newUserPartial' }]])
  .select($ => $.select(['id', 'name', 'email']))
```

This produces:

```graphql
fragment UserFields on User @deprecated(reason: "use newUserPartial") {
  id
  name
  email
}
```

### Partials with variables

Partials can also declare their own variables:

```ts
const userPartial = gazania.partial('UserFields')
  .on('User')
  .vars({ includeEmail: 'Boolean!' })
  .select(($, vars) => $.select([
    'id',
    'name',
    {
      email: $ => $.directives(['@include', { if: vars.includeEmail }]),
    },
  ]))
```

## Sections

Sections are the opt-out path for fragment masking. They use the same GraphQL fragment spread output as partials, but the result type exposes the actual selected fields directly.

```ts
const userBasicFields = gazania.section('UserBasicFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))

const query = gazania.query('GetUsers')
  .select($ => $.select([{
    users: $ => $.select([
      ...userBasicFields({}),
      '__typename',
    ]),
  }]))
```

The generated GraphQL is still a fragment spread:

```graphql
query GetUsers {
  users {
    ...UserBasicFields
    __typename
  }
}

fragment UserBasicFields on User {
  id
  name
  email
}
```

The resulting query type is transparent for the section fields, so you can access them directly without `readFragment()`.

## Fragment masking

When a partial is spread into a query, its fields are masked in the result type. The position carries an opaque `FragmentRef` marker instead of the concrete fields. You call `readFragment()` to access them.

This prevents accidental coupling: each component only sees the data it declared.

### Typing component props with `FragmentOf`

Use `FragmentOf<typeof partial>` to type the masked fragment reference in component props:

```ts
import type { FragmentOf } from 'gazania'
import { readFragment } from 'gazania'

const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))

// Type for the masked reference
type UserFieldsRef = FragmentOf<typeof userPartial>
// FragmentRef<'UserFields', 'User'>

function UserCard(props: { user: FragmentOf<typeof userPartial> }) {
  // Unmask to access the concrete fields (zero runtime cost)
  const user = readFragment(userPartial, props.user)
  // user: { id: number, name: string, email: string }
}
```

### Reading masked data with `readFragment`

`readFragment` is an identity function at runtime: it only does a type-level cast, so there is no performance overhead.

```ts
import { readFragment } from 'gazania'

// Non-nullable
const user = readFragment(userPartial, result.user)
// → { id: number, name: string, email: string }

// Nullable (null/undefined is preserved)
const user = readFragment(userPartial, result.user ?? null)
// → { id: number, name: string, email: string } | null | undefined

// Array
const users = readFragment(userPartial, result.users)
// → ReadonlyArray<{ id: number, name: string, email: string }>
```

### End-to-end example

```ts
import type { FragmentOf, ResultOf } from 'gazania'
import { gazania, readFragment } from 'gazania'

// Define a partial for the UserCard component
const userCardPartial = gazania.partial('UserCardFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))

// Compose into a query
const getUsersQuery = gazania.query('GetUsers')
  .select($ => $.select([{
    users: $ => $.select([
      ...userCardPartial({}),
      '__typename',
    ]),
  }]))

// result.users items are masked — concrete fields are not directly accessible
type QueryResult = ResultOf<typeof getUsersQuery>
// QueryResult['users'][number] = { __typename: string } & FragmentRef<'UserCardFields', 'User'>

// In the UserCard component, unmask to access the fields
function UserCard(props: { user: FragmentOf<typeof userCardPartial> }) {
  const user = readFragment(userCardPartial, props.user)
  return `${user.name} <${user.email}>`
}
```

## Fragments vs partials

Fragments are standard GraphQL: named, reusable selection sets on a type, compiled to standard fragment documents.

Partials are a Gazania abstraction on top of fragments. They give you a simpler API for composing selections, with fragment masking built in.

| Feature | Fragment | Partial |
|---|---|---|
| Produces | `DocumentNode` | Spreadable selection package |
| Composable in queries | Not directly (standalone document) | Yes, via `...partial(vars)` |
| Auto fragment spread | No | Yes |
| Fragment masking support | No | Yes, via `FragmentOf` + `readFragment` |
| Type-safe field isolation | No | Yes |
| Directive on spread | N/A | Yes |
| Use case | Interop with raw GraphQL tooling | Composing type-safe selections in Gazania queries |

### When to use what

- **Fragments**: when you need standard GraphQL fragments, for example when working with tools that consume raw `DocumentNode` objects.
- **Partials**: when building queries in Gazania. They handle fragment spread mechanics and enforce field isolation through masking.
