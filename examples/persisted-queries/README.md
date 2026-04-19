# Example: Persisted Queries

Demonstrates the full persisted queries workflow with Gazania.

API used: `https://nitro-graphql-tester.pages.dev/graphql-user`

## Workflow

### 1. Generate schema types

Fetches the schema from the API and writes TypeScript types to `src/schema.ts`:

```sh
pnpm generate
```

### 2. Write queries

Queries are defined in `src/queries.ts` using the Gazania builder:

```ts
import { createGazania } from 'gazania'

const gazania = createGazania('https://nitro-graphql-tester.pages.dev/graphql-user')

export const GetUsers = gazania.query('GetUsers')
  .select($ => $.select([{
    users: $ => $.select(['id', 'name']),
  }]))
```

### 3. Extract the manifest

Scans `src/` for all Gazania builder calls and writes `gazania-manifest.json`:

```sh
pnpm extract
```

The manifest maps each operation name to its printed query body and SHA-256 hash:

```json
{
  "operations": {
    "GetUsers": {
      "body": "query GetUsers {\n  users {\n    id\n    name\n  }\n}",
      "hash": "sha256:4d6d63bdb0..."
    }
  },
  "fragments": {}
}
```

This file can be uploaded to your GraphQL server's trusted document allowlist.

### 4. Run the app

```sh
pnpm dev
```

`src/index.ts` loads the manifest at runtime, verifies the hashes, and sends live
queries to the API using the pre-extracted query bodies.
