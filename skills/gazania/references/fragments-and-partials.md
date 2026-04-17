# Fragments & Partials

Gazania has two ways to reuse selection sets: **fragments** (compile to GraphQL named fragments) and **partials** (fragments with masking, for component-level data isolation).

## Fragments

### Basic fragment

```ts
const userFragment = gazania.fragment('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))
```

### Limitations of fragments
Fragments are designed to be used with other GraphQL libraries when you clearly need a fragment in the GraphQL document, such merging to / from other typed graphql query libraries.

If you are using Gazania to build your queries, it's often better to use partials instead, which have better type safety and flexibility.

## Partials

Partials are fragments with better type safety and flexibility, designed for reuse within Gazania queries.

### Define a partial

```ts
const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))
```

### Spread a partial into a query

Use the spread syntax inside `.select()`:

```ts
const query = gazania.query('GetUser')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select([
      ...userPartial($),
      '__typename',
    ]),
  }]))
```

### Pass directives at the spread site

Directives here are applied to the fragment spread (`...UserFields @cached(ttl: 30)`):

```ts
...userPartial($, [['@cached', { ttl: 30 }]])
```

### Partial with variables

```ts
const userPartial = gazania.partial('UserFields')
  .on('User')
  .vars({ includeEmail: 'Boolean!' })
  .select(($, vars) => $.select([
    'id',
    'name',
    { email: $ => $.withDirective(['@include', { if: vars.includeEmail }]) },
  ]))
```

## Fragment masking

When a partial is spread in a query, its fields are **masked** in the result: the position holds an opaque `FragmentRef` marker instead of the concrete fields. Call `readFragment()` to access them.

### Type component props with `FragmentOf`

```ts
import type { FragmentOf } from 'gazania'
import { readFragment } from 'gazania'

interface UserCardProps {
  user: FragmentOf<typeof userPartial>
}

function UserCard({ user }: UserCardProps) {
  const data = readFragment(userPartial, user)
  // data: { id: number, name: string, email: string }
  return <div>{data.name}</div>
}
```

### Why masking matters

Without masking, a parent component can accidentally depend on data fetched only for a child. Masking enforces that data ownership matches component boundaries — if you refactor the child's partial, TypeScript tells you which parents break.
