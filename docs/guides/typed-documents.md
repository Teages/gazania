# Typed documents

Gazania infers result and variable types from your operations. Here's how to extract and use them.

## ResultOf

Use `ResultOf` to extract the result type of a query, mutation, subscription, or fragment:

```ts
import type { ResultOf } from 'gazania'

const userQuery = gazania.query('GetUser')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select([
      'id',
      'name',
      'email',
    ]),
  }]))

type UserResult = ResultOf<typeof userQuery>
// { user: { id: number, name: string, email: string } }
```

### How types are inferred

Gazania uses your schema types and the selection set to compute the result type:

- **Scalar fields** map to their TypeScript equivalents (`String` -> `string`, `Int` -> `number`, etc.)
- **Object fields** are typed recursively from their nested selections
- **List fields** become arrays
- **Nullable fields** include `null`
- **Enum fields** become string literal unions

### Fragments

`ResultOf` also works with fragments:

```ts
const userFragment = gazania.fragment('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))

type UserFields = ResultOf<typeof userFragment>
// { id: number, name: string, email: string }
```

## VariablesOf

Use `VariablesOf` to extract the variable types of an operation:

```ts
import type { VariablesOf } from 'gazania'

const addSaying = gazania.mutation('AddSaying')
  .vars({ ownerId: 'Int!', content: 'String!', category: 'CategoryEnum!' })
  .select(($, vars) => $.select([{
    addSaying: $ => $.args({
      ownerId: vars.ownerId,
      input: {
        content: vars.content,
        category: vars.category,
      },
    }).select(['id']),
  }]))

type AddSayingVars = VariablesOf<typeof addSaying>
// { ownerId: number, content: string, category: 'funny' | 'jokes' | 'serious' }
```

### Variable type mapping

Variable type strings are mapped to TypeScript types:

| Variable Definition | TypeScript Type |
|---|---|
| `'String'` | `string \| null \| undefined` |
| `'String!'` | `string` |
| `'Int!'` | `number` |
| `'[String!]!'` | `string[]` |
| `'Boolean'` | `boolean \| null \| undefined` |
| `'String = "default"'` | `string \| null \| undefined` |

Variables with default values or nullable types are optional in the resulting type.

## TypedDocumentNode

Operations built with Gazania return `TypedDocumentNode` objects that carry both the result and variable types. This is compatible with popular GraphQL clients:

```ts
import type { TypedDocumentNode } from 'gazania'

// The query carries its types
const query: TypedDocumentNode<
  { user: { id: number, name: string } },
  { id: number }
> = gazania.query('GetUser')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select(['id', 'name']),
  }]))
```

### Client integration

`TypedDocumentNode` is a standard interface, so you can use the built documents with any GraphQL client that supports it:

```ts
// Example with a generic execute function
async function execute<TResult, TVars>(
  document: TypedDocumentNode<TResult, TVars>,
  variables: TVars,
): Promise<TResult> {
  // Your GraphQL client call here
}

// Variables and result are fully typed
const result = await execute(query, { id: 1 })
// result.user.name is typed as string
```

## Directives and nullability

Directives like `@skip` or `@include` make the field potentially absent, so the type becomes nullable:

```ts
const skipQuery = gazania.query('SkipQuery')
  .select($ => $.select([{
    hello: $ => $.withDirective(['@skip', { if: true }]),
  }]))

type SkipResult = ResultOf<typeof skipQuery>
// { hello: string | null | undefined }
```

The field becomes nullable because `@skip` can remove it from the response.
