# Setup & Configuration

## Requirements

- Node.js >= 22.12.0
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

Create `gazania.config.ts` in the project root (use `gazania.config.js` if not using TypeScript config):

```ts
import { defineConfig } from 'gazania/config'

export default defineConfig({
  schemas: [
    {
      schema: 'https://api.example.com/graphql',
      output: 'src/schema.ts',
    },
  ],
})
```

Then run without arguments:

```sh
npx gazania generate
```

> **Important:** Add the generated schema file to `.gitignore`. Do **not** commit it to version control.
> The format of generated schema files is not considered stable — it may change across Gazania releases
> without a semver major bump for the package. Regenerate the file as part of your build or CI pipeline instead.
>
> ```
> # .gitignore
> src/schema.ts
> ```

#### Authenticated endpoints

```ts
import { defineConfig } from 'gazania/config'

export default defineConfig({
  schemas: [
    {
      schema: {
        url: 'https://api.example.com/graphql',
        headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
      },
      output: 'src/schema.ts',
    },
  ],
})
```

#### Custom scalar mappings

Custom scalars default to `string`. Override with the `scalars` option:

```ts
import { defineConfig } from 'gazania/config'

export default defineConfig({
  schemas: [
    {
      schema: 'https://api.example.com/graphql',
      output: 'src/schema.ts',
      scalars: {
        DateTime: 'string',
        JSON: 'Record<string, unknown>',
        BigInt: { input: 'string | number', output: 'string' }, // different input/output types
      },
    },
  ],
})
```

#### Multiple schemas in one config

Pass an array to generate multiple output files in one run:

```ts
import { defineConfig } from 'gazania/config'

export default defineConfig({
  schemas: [
    { schema: 'https://api-a.example.com/graphql', output: 'src/schema-a.ts' },
    { schema: 'https://api-b.example.com/graphql', output: 'src/schema-b.ts' },
  ],
})
```

## Initialize the builder

```ts
import { createGazania } from 'gazania'

const gazania = createGazania('https://api.example.com/graphql')
```

The generated schema file registers itself by URL via module augmentation, so you can reference the schema by its URL without importing the generated type in every file.

### Passing schema types directly

As an alternative, you can import and pass the schema type:

```ts
import type { Schema } from './schema'
import { createGazania } from 'gazania'

const gazania = createGazania({} as Schema)
```

Always pass `{} as Schema` — never a real runtime object.

### Multiple schemas

When using multiple schemas, create a separate `createGazania` instance for each URL:

```ts
import { createGazania } from 'gazania'

const apiA = createGazania('https://api-a.example.com/graphql')
const apiB = createGazania('https://api-b.example.com/graphql')
```

Or with direct type imports:

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
import { writeFile } from 'node:fs/promises'
import { generate } from 'gazania/codegen'

const sdl = `type Query { hello: String }`

const code = generate({
  source: sdl,
  scalars: { DateTime: 'string' },
})
await writeFile('src/schema.ts', code)
```
