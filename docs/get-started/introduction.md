# Introduction

Gazania is a TypeScript library for writing GraphQL queries with type safety. Your editor knows your schema, so you get autocompletion and type checking on queries, mutations, and selections.

## Why Gazania?

GraphQL queries in TypeScript projects are usually untyped strings. If you rename a field or misspell an argument, you only find out at runtime. Gazania lets you write queries as TypeScript code, so the compiler catches those mistakes.

What you get:

- Query results and variables are typed based on your schema and selections
- If a selection doesn't match the schema, TypeScript tells you
- Autocompletion for field names, arguments, and types in your editor

### Measured production trade-offs

Gazania targets clients that need a GraphQL `DocumentNode`. It ships a compact builder expression and constructs the AST without a GraphQL parser. The comparison suite verifies that Gazania and `graphql-tag` produce the same printed document before measuring them.

On a cold cache — the cost paid once for each distinct static operation during page or module startup — Gazania constructs the tested documents about 5–8x faster than `graphql-tag` parses them. A startup model with 100 definitions still measured Gazania about 2x faster when 75% of the `graphql-tag` definitions were duplicates and hit its cache. These are startup construction results, not per-request latency; both libraries normally reuse the resulting document after initialization.

Gazania also removes operation-level code generation from the development loop. Editing a query updates its inferred result and variable types in the same TypeScript pass, without waiting for a document generator or watch process. Schema types are generated separately and only need to be regenerated when the schema changes.

Bundle size has a real fixed-versus-variable trade-off. The table below repeats the same mid-size query shape with unique operation names and reports total browser bundles (esbuild, ESM, minified, min / gzip):

| DocumentNode path | 1 operation | 10 operations | 50 operations |
| --- | ---: | ---: | ---: |
| Gazania compact builder → AST | 9,419 B / 3,144 B | 11,337 B / 3,193 B | 19,897 B / 3,365 B |
| `graphql-tag` source + runtime parser | 36,585 B / 9,631 B | 38,350 B / 9,676 B | 46,230 B / 9,834 B |
| client-preset default document map | 1,611 B / 445 B | 15,492 B / 674 B | 77,294 B / 1,547 B |
| client-preset optimized direct AST | 1,173 B / 293 B | 11,434 B / 432 B | 57,074 B / 949 B |

For one or a few operations, a directly imported precompiled AST is the smaller bundle. As the operation count grows, Gazania's fixed runtime is amortized and its raw JavaScript becomes smaller because it does not embed the full AST for every operation; precompiled ASTs remain highly gzip-compressible, so their transferred gzip size can still be lower. The `graphql-tag` runtime path pays both for source strings and for shipping a parser.

Tree-shaking or the client-preset optimizer removes unused documents, but every document used by a route still carries its AST. String-only document modes are a different trade-off and are excluded here because they do not provide a client-side `DocumentNode`.

Run the comparisons with `BENCH_COMPARE=1 pnpm vitest bench --run bench/compare/runtime-compare.bench.ts` (cold construction and cache model) and `node bench/compare/size-compare.mjs` (bundle scaling).

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
