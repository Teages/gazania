# Config format

Gazania uses a config file for schema generation. The config file is a JavaScript or TypeScript module with a default export.

## File names

The CLI looks for the following files (in order):

1. `gazania.config.ts` — TypeScript (requires Node.js 22.6+)
2. `gazania.config.js` — JavaScript

## `defineConfig`

Use `defineConfig` from `gazania/codegen` for type checking and autocompletion.

**Single schema:**

```ts
import { defineConfig } from 'gazania/codegen'

export default defineConfig({
  schema: 'https://api.example.com/graphql',
  output: 'src/schema.ts',
})
```

**Multiple schemas** — pass an array to generate several output files in one run:

```ts
import { defineConfig } from 'gazania/codegen'

export default defineConfig([
  {
    schema: 'https://api-a.example.com/graphql',
    output: 'src/schema-a.ts',
  },
  {
    schema: 'https://api-b.example.com/graphql',
    output: 'src/schema-b.ts',
  },
])
```

Each entry in the array is an independent `Config` object and supports all the same options described below.

## Config options

### `schema`

- **Type:** `SchemaLoader`
- **Required:** Yes

The GraphQL schema source. Accepts several formats:

#### String (URL or file path)

```ts
export default defineConfig({
  schema: 'https://api.example.com/graphql',
})

export default defineConfig({
  schema: './schema.graphql',
})

export default defineConfig({
  schema: './introspection.json',
})
```

#### URL with options

```ts
export default defineConfig({
  schema: {
    url: 'https://api.example.com/graphql',
    headers: {
      Authorization: 'Bearer my-token',
    },
    method: 'POST', // default: 'POST'
  },
})
```

| Property | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | — | GraphQL endpoint URL |
| `headers` | `Record<string, string>` | `undefined` | HTTP headers |
| `method` | `'GET' \| 'POST'` | `'POST'` | HTTP method |

#### Inline SDL

```ts
export default defineConfig({
  schema: {
    sdl: `
      type Query {
        hello: String!
      }
    `,
  },
})
```

| Property | Type | Description |
|---|---|---|
| `sdl` | `string` | GraphQL Schema Definition Language string |

#### Inline JSON

```ts
export default defineConfig({
  schema: {
    json: '{ "data": { "__schema": { ... } } }',
  },
})
```

| Property | Type | Description |
|---|---|---|
| `json` | `string` | JSON introspection result string |

#### Custom getter function

```ts
export default defineConfig({
  schema: async () => {
    const response = await fetch('https://api.example.com/graphql', {
      method: 'POST',
      body: JSON.stringify({ query: getIntrospectionQuery() }),
    })
    const result = await response.json()
    return buildClientSchema(result.data)
  },
})
```

| Type | Description |
|---|---|
| `() => string \| Promise<string>` | Function that returns SDL string |

### `output`

- **Type:** `string`
- **Required:** Yes

Output file path for the generated TypeScript definitions. Relative paths are resolved from the current working directory.

```ts
export default defineConfig({
  output: 'src/schema.ts',
})

export default defineConfig({
  output: './generated/graphql-types.ts',
})
```

### `scalars`

- **Type:** `Record<string, string | { input: string, output: string }>`
- **Required:** No

Custom TypeScript type mappings for GraphQL scalars. By default, custom scalars (beyond the built-in `String`, `Int`, `Float`, `Boolean`, `ID`) are typed as `string`.

#### Simple mapping

When a scalar has the same type for input and output:

```ts
export default defineConfig({
  scalars: {
    DateTime: 'string',
    JSON: 'Record<string, unknown>',
    BigInt: 'bigint',
  },
})
```

#### Input/output mapping

When input and output types differ:

```ts
export default defineConfig({
  scalars: {
    Date: {
      input: 'string', // what you pass as a variable
      output: 'Date', // what you get back in results
    },
  },
})
```

## Complete example

```ts
import { defineConfig } from 'gazania/codegen'

export default defineConfig({
  schema: {
    url: 'https://api.example.com/graphql',
    headers: {
      Authorization: `Bearer ${process.env.GRAPHQL_TOKEN}`,
    },
  },
  output: 'src/generated/schema.ts',
  scalars: {
    DateTime: 'string',
    JSON: 'Record<string, unknown>',
    Upload: {
      input: 'File',
      output: 'string',
    },
  },
})
```

## Multiple schemas example

```ts
import { defineConfig } from 'gazania/codegen'

export default defineConfig([
  {
    schema: {
      url: 'https://api-a.example.com/graphql',
      headers: { Authorization: `Bearer ${process.env.TOKEN_A}` },
    },
    output: 'src/generated/schema-a.ts',
    scalars: { DateTime: 'string' },
  },
  {
    schema: 'https://api-b.example.com/graphql',
    output: 'src/generated/schema-b.ts',
  },
])
```

## Codegen API

The config format matches the `Config` and `UserConfig` types exported from `gazania/codegen`:

```ts
import type { Config, UserConfig } from 'gazania/codegen'
// UserConfig = Config | Config[]
```

You can also use the codegen API programmatically. See the [Workflows](/get-started/workflows#programmatic-api) page for details.
