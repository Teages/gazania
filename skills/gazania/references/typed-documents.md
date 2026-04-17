# Typed Documents

Gazania infers result and variable types from your operations. Never write these types by hand — always extract them with the utilities below.

## `ResultOf`

Extracts the result type of a query, mutation, subscription, or fragment:

```ts
import type { ResultOf } from 'gazania'

const userQuery = gazania.query('GetUser')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select(['id', 'name', 'email']),
  }]))

type UserResult = ResultOf<typeof userQuery>
// { user: { id: number, name: string, email: string } }
```

Works on fragments too:

```ts
const userFragment = gazania.fragment('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))

type UserFields = ResultOf<typeof userFragment>
// { id: number, name: string, email: string }
```

### How fields map to TypeScript types

| GraphQL type | TypeScript type |
|---|---|
| `String!` | `string` |
| `String` | `string \| null` |
| `Int!` | `number` |
| `Boolean!` | `boolean` |
| `[String!]!` | `string[]` |
| `EnumType!` | `'VALUE_A' \| 'VALUE_B'` |
| Nested object | recursively inferred object |

### Directives and nullability

`@skip` and `@include` make the field potentially absent, so the type becomes nullable:

```ts
type SkipResult = ResultOf<typeof skipQuery>
// { hello: string | null | undefined }
```

## `VariablesOf`

Extracts the variable types of an operation:

```ts
import type { VariablesOf } from 'gazania'

const addSaying = gazania.mutation('AddSaying')
  .vars({ ownerId: 'Int!', content: 'String!', category: 'CategoryEnum!' })
  .select(/* ... */)

type AddSayingVars = VariablesOf<typeof addSaying>
// { ownerId: number, content: string, category: 'funny' | 'jokes' | 'serious' }
```

Variables declared as nullable or with a default become optional:

| Variable definition | TypeScript type |
|---|---|
| `'String!'` | `string` |
| `'String'` | `string \| null \| undefined` |
| `'String = "default"'` | `string \| null \| undefined` |

## `TypedDocumentNode`

Every Gazania operation is a `TypedDocumentNode<TResult, TVars>` — a standard interface supported by most GraphQL clients (urql, Apollo, etc.):

```ts
import type { TypedDocumentNode } from 'gazania'

// Explicit annotation when passing to a typed function
const query: TypedDocumentNode<
  { user: { id: number, name: string } },
  { id: number }
> = gazania.query('GetUser')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select(['id', 'name']),
  }]))
```

In practice, you rarely need the explicit annotation — the type is inferred automatically.

### Client integration

Pass the document directly to any client that accepts `TypedDocumentNode`:

```ts
// Generic execute helper (your actual client call goes here)
async function execute<TResult, TVars>(
  document: TypedDocumentNode<TResult, TVars>,
  variables: TVars,
): Promise<TResult> {
  // e.g. urql, Apollo, or a fetch wrapper
}

const result = await execute(userQuery, { id: 1 })
// result.user.name — typed as string
```
