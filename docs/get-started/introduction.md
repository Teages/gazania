# Introduction

Gazania is a TypeScript library for writing GraphQL queries with type safety. Your editor knows your schema, so you get autocompletion and type checking on queries, mutations, and selections.

## Why Gazania?

GraphQL queries in TypeScript projects are usually untyped strings. If you rename a field or misspell an argument, you only find out at runtime. Gazania lets you write queries as TypeScript code, so the compiler catches those mistakes.

What you get:

- Query results and variables are typed based on your schema and selections
- If a selection doesn't match the schema, TypeScript tells you
- Autocompletion for field names, arguments, and types in your editor

### Measured against the alternatives

The same operations, built as gazania chains vs parsed with `graphql-tag` (mean times from the comparison suite in `bench/compare/`, single run on a dev laptop):

| Scenario | gazania | graphql-tag | gazania faster |
| --- | --- | --- | --- |
| simple flat query | ~0.9µs | ~6.0µs | 7.0x |
| variables + args | ~1.8µs | 11.7µs | 6.6x |
| nested two levels | 2.4µs | 16.0µs | 6.8x |
| union inline fragments | 2.0µs | 13.0µs | 6.5x |
| complex mixed query | 4.0µs | 30.2µs | 7.5x |
| build + print end-to-end | 10.9µs | 51.1µs | 4.7x |

Gazania builds the AST programmatically and never runs a GraphQL parser, so the gap grows with query complexity.

Compared to `@graphql-codegen/client-preset` at compile time, type-checking query usage is at parity (178–194ms vs 170–207ms per scenario, mostly within run noise) — but codegen needs a generation step (~6ms per run on this schema, growing with schema size), a watch process, and can serve stale types. Gazania has no build step at all.

In the bundle, one mid-size query — `GetUserDeep`: 11 fields over 3 levels of nesting, about 115 characters of GraphQL — costs (esbuild, ESM, minified):

| | per query (min / gzip) | runtime (min / gzip) |
| --- | --- | --- |
| gazania | 181 B / 84 B | 9.2 KB / 3.0 KB |
| graphql-tag | 155 B / 79 B | 36.4 KB / 9.5 KB |
| codegen client-preset | 1510 B / 87 B | grows with every operation |

A gazania query compiles to about the same bytes as a graphql-tag query string, and its runtime is 3x smaller because no GraphQL parser ships to the browser. Client-preset inlines each operation's full AST into the document map — 8x more raw bytes per query (it gzips well, but the browser still parses them all), and the map cannot be tree-shaken per operation.

Run the comparisons yourself with `BENCH_COMPARE=1 pnpm vitest bench --run bench/compare` (speed) and `node bench/compare/size-compare.mjs` (size).

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
