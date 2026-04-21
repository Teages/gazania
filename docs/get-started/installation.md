# Installation

## Install the package

::: code-group

```sh [npm]
npm install gazania
```

```sh [pnpm]
pnpm install gazania
```

```sh [yarn]
yarn add gazania
```

```sh [bun]
bun install gazania
```

:::

## Requirements

- **Node.js** >= 20.0.0
- **TypeScript** >= 5.0 (recommended)

## Generate schema types

Gazania needs TypeScript types generated from your GraphQL schema. Use the CLI:

```sh
npx gazania generate --schema https://api.example.com/graphql --output src/schema.ts
```

Or from a local schema file:

```sh
npx gazania generate --schema schema.graphql --output src/schema.ts
```

This writes a TypeScript file with all the type definitions from your schema. See [Workflows](/get-started/workflows) for more on schema generation and configuration.

::: warning Do not commit the generated schema file
Add the output file to `.gitignore`. The format of generated schema files is **not** a stability guarantee — it may change in any Gazania release without a major version bump. Regenerate as part of your build or CI pipeline.

```
# .gitignore
src/schema.ts
```
:::

## Basic setup

Import the generated types and pass them to `createGazania`:

```ts
import type { Schema } from './schema'
import { createGazania } from 'gazania'

const gazania = createGazania({} as Schema)
```

The `gazania` object gives you typed builders for GraphQL operations:

- `gazania.query()`: queries
- `gazania.mutation()`: mutations
- `gazania.subscription()`: subscriptions
- `gazania.fragment()`: named fragments
- `gazania.partial()`: reusable selection partials
- `gazania.enum()`: typed enum values

## Named schema registration

You can register schemas by name using module augmentation. The generated schema file can register itself:

```ts
// In your generated schema file
declare module 'gazania' {
  interface Schemas {
    'https://api.example.com/graphql': Schema
  }
}
```

Then use the schema by URL:

```ts
import { createGazania } from 'gazania'

const gazania = createGazania('https://api.example.com/graphql')
```
