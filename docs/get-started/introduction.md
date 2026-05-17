# Introduction

Gazania is a TypeScript library for writing GraphQL queries with type safety. Your editor knows your schema, so you get autocompletion and type checking on queries, mutations, and selections.

## Why Gazania?

GraphQL queries in TypeScript projects are usually untyped strings. If you rename a field or misspell an argument, you only find out at runtime. Gazania lets you write queries as TypeScript code, so the compiler catches those mistakes.

What you get:

- Query results and variables are typed based on your schema and selections
- If a selection doesn't match the schema, TypeScript tells you
- Autocompletion for field names, arguments, and types in your editor

## How it works

Two steps:

1. Generate TypeScript types from your GraphQL schema using the CLI or the codegen API.

2. Use `createGazania()` with your schema URL. The returned builder gives you typed methods for building operations.

```ts
import type { ResultOf, VariablesOf } from 'gazania'
import { createGazania } from 'gazania'

// Create a typed builder from your schema URL
const gazania = createGazania('https://api.example.com/graphql')

// Build a query with full type inference
const userQuery = gazania.query('GetUser')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select([
      'id',
      'name',
      'email',
    ]),
  }]))

// Types are automatically inferred
type Result = ResultOf<typeof userQuery>
// { user: { id: number, name: string, email: string } }

type Variables = VariablesOf<typeof userQuery>
// { id: number }
```

## Next steps

- [Installation](/get-started/installation): Set up Gazania in your project
- [Writing queries](/get-started/writing-queries): Learn the query builder API
- [Workflows](/get-started/workflows): Schema generation and configuration
