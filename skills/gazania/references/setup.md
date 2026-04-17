# Setup & Configuration

## Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0

## Install

```sh
pnpm install gazania
```

## Generate schema types

Gazania requires a TypeScript types file generated from your GraphQL schema.

### One-off CLI

```sh
# From a URL
npx gazania generate --schema https://api.example.com/graphql --output src/schema.ts

# From a local file
npx gazania generate --schema schema.graphql --output src/schema.ts

# From an introspection JSON
npx gazania generate --schema introspection.json --output src/schema.ts
```

### Config file (recommended)

Create `gazania.config.ts` in the project root (requires Node.js >= 22.6; use `gazania.config.js` otherwise):

```ts
import { defineConfig } from 'gazania/codegen'

export default defineConfig({
  schema: 'https://api.example.com/graphql',
  output: 'src/schema.ts',
})
```

Then run without arguments:

```sh
npx gazania generate
```

#### Authenticated endpoints

```ts
import { defineConfig } from 'gazania/codegen'

export default defineConfig({
  schema: {
    url: 'https://api.example.com/graphql',
    headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
  },
  output: 'src/schema.ts',
})
```

#### Custom scalar mappings

Custom scalars default to `string`. Override with the `scalars` option:

```ts
import { defineConfig } from 'gazania/codegen'

export default defineConfig({
  schema: 'https://api.example.com/graphql',
  output: 'src/schema.ts',
  scalars: {
    DateTime: 'string',
    JSON: 'Record<string, unknown>',
    BigInt: { input: 'string | number', output: 'string' }, // different input/output types
  },
})
```

#### Multiple schemas in one config

Pass an array to generate multiple output files in one run:

```ts
import { defineConfig } from 'gazania/codegen'

export default defineConfig([
  { schema: 'https://api-a.example.com/graphql', output: 'src/schema-a.ts' },
  { schema: 'https://api-b.example.com/graphql', output: 'src/schema-b.ts' },
])
```

## Initialize the builder

```ts
import type { Schema } from './schema'
import { createGazania } from 'gazania'

const gazania = createGazania({} as Schema)
```

Always pass `{} as Schema` — never a real runtime object.

### Named schema registration (optional)

Register a schema by URL via module augmentation so it can be referenced by name:

```ts
// In your generated schema file
declare module 'gazania' {
  interface Schemas {
    'https://api.example.com/graphql': Schema
  }
}
```

```ts
// Then use by name instead of passing the type
const gazania = createGazania('https://api.example.com/graphql')
```

When using multiple schemas, create a separate `createGazania` instance for each:

```ts
import type { Schema as SchemaA } from './schema-a'
import type { Schema as SchemaB } from './schema-b'
import { createGazania } from 'gazania'

const apiA = createGazania({} as SchemaA)
const apiB = createGazania({} as SchemaB)
```

## Programmatic codegen API

Use `gazania/codegen` in build scripts instead of the CLI:

```ts
import { generate } from 'gazania/codegen'
import { writeFile } from 'node:fs/promises'

const code = await generate('https://api.example.com/graphql', {
  scalars: { DateTime: 'string' },
})
await writeFile('src/schema.ts', code)
```

Lower-level functions for more control:

```ts
import { loadSchema, parseSchema, printSchema } from 'gazania/codegen'

const sdl = await loadSchema('https://api.example.com/graphql')
const schemaData = parseSchema(sdl, { scalars: { DateTime: 'string' } })
const code = printSchema(schemaData)
```
