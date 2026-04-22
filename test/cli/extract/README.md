# Feature: Persisted Queries

Demonstrates the full persisted queries workflow with Gazania.

API used: `https://graphql-test.teages.xyz/graphql-user-apq`

## Workflow

### 1. Generate schema types

Fetches the schema from the API and writes TypeScript types to `src/schema.ts`:

```sh
pnpm generate
```

### 2. Write queries

This example defines the query in `src/index.ts` and reuses the same operation in `src/index.vue`, `src/react.tsx`, and `src/index.svelte`.

```ts
import { createGazania } from 'gazania'

const gazania = createGazania('https://graphql-test.teages.xyz/graphql-user-apq')

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

## Useful Commands

- update schema: `gazania generate --schema https://graphql-test.teages.xyz/graphql-user-apq --output test/feature/extract/fixture/src/schema.ts`
