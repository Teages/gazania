# Config format

Gazania uses a config file for schema generation and query extraction. The config file is a JavaScript or TypeScript module with a default export.

## File names

The CLI looks for the following files (in order):

1. `gazania.config.ts` — TypeScript (requires Node.js 22.6+)
2. `gazania.config.js` — JavaScript

## `defineConfig`

Use `defineConfig` from `gazania/config` for type checking and autocompletion.

**Single schema:**

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

**Multiple schemas** — add more entries to the `schemas` array:

```ts
import { defineConfig } from 'gazania/config'

export default defineConfig({
  schemas: [
    {
      schema: 'https://api-a.example.com/graphql',
      output: 'src/schema-a.ts',
    },
    {
      schema: 'https://api-b.example.com/graphql',
      output: 'src/schema-b.ts',
    },
  ],
})
```

Each entry in the `schemas` array is an independent `SchemaConfig` object and supports all the same options described below.

## Top-level options

### `schemas`

- **Type:** `SchemaConfig[]`
- **Required:** Yes

An array of schema configurations. Each entry defines a GraphQL schema source, an output file path, and optional scalar mappings. See [SchemaConfig options](#schemaconfig-options) below.

### `extract`

- **Type:** `ExtractConfig`
- **Required:** No

Configuration for the `gazania extract` command. All fields are optional and serve as defaults that CLI flags can override.

```ts
export default defineConfig({
  schemas: [
    { schema: 'https://api.example.com/graphql', output: 'src/schema.ts' },
  ],
  extract: {
    dir: 'src',
    output: 'dist/manifest.json',
    algorithm: 'sha256',
    tsconfig: 'tsconfig.json',
    strict: false,
  },
})
```

| Property | Type | Default | Description |
|---|---|---|---|
| `dir` | `string` | `'src'` | Directory to scan |
| `output` | `string \| null` | `null` (stdout) | Output manifest file path |
| `include` | `string` | `'**/*.{ts,tsx,js,jsx,vue,svelte}'` | File glob pattern |
| `algorithm` | `string` | `'sha256'` | Hash algorithm |
| `tsconfig` | `string` | `'tsconfig.json'` | Path to tsconfig.json |
| `strict` | `boolean` | `false` | Treat deprecated field warnings as errors |
| `noEmit` | `boolean` | `false` | Suppress manifest output |
| `ignoreCategories` | `('unresolved' \| 'analysis' \| 'circular')[]` | `[]` | Error categories to ignore |

## SchemaConfig options

### `schema`

- **Type:** `SchemaLoader`
- **Required:** Yes

The GraphQL schema source. Accepts several formats:

#### String (URL or file path)

```ts
export default defineConfig({
  schemas: [{
    schema: 'https://api.example.com/graphql',
    output: 'src/schema.ts',
  }],
})

export default defineConfig({
  schemas: [{
    schema: './schema.graphql',
    output: 'src/schema.ts',
  }],
})

export default defineConfig({
  schemas: [{
    schema: './introspection.json',
    output: 'src/schema.ts',
  }],
})
```

#### URL with options

```ts
export default defineConfig({
  schemas: [{
    schema: {
      url: 'https://api.example.com/graphql',
      headers: {
        Authorization: 'Bearer my-token',
      },
      method: 'POST', // default: 'POST'
    },
    output: 'src/schema.ts',
  }],
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
  schemas: [{
    schema: {
      sdl: `
        type Query {
          hello: String!
        }
      `,
    },
    output: 'src/schema.ts',
  }],
})
```

| Property | Type | Description |
|---|---|---|
| `sdl` | `string` | GraphQL Schema Definition Language string |

#### Inline JSON

```ts
export default defineConfig({
  schemas: [{
    schema: {
      json: '{ "data": { "__schema": { ... } } }',
    },
    output: 'src/schema.ts',
  }],
})
```

| Property | Type | Description |
|---|---|---|
| `json` | `string` | JSON introspection result string |

#### Custom getter function

```ts
export default defineConfig({
  schemas: [{
    schema: async () => {
      const response = await fetch('https://api.example.com/graphql', {
        method: 'POST',
        body: JSON.stringify({ query: getIntrospectionQuery() }),
      })
      const result = await response.json()
      return buildClientSchema(result.data)
    },
    output: 'src/schema.ts',
  }],
})
```

| Type | Description |
|---|---|
| `() => string \| GraphQLSchema \| Promise<string \| GraphQLSchema>` | Function that returns an SDL string or GraphQLSchema |

### `output`

- **Type:** `string`
- **Required:** Yes

Output file path for the generated TypeScript definitions. Relative paths are resolved from the current working directory.

```ts
export default defineConfig({
  schemas: [{
    schema: 'https://api.example.com/graphql',
    output: 'src/schema.ts',
  }],
})

export default defineConfig({
  schemas: [{
    schema: 'https://api.example.com/graphql',
    output: './generated/graphql-types.ts',
  }],
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
  schemas: [{
    schema: 'https://api.example.com/graphql',
    output: 'src/schema.ts',
    scalars: {
      DateTime: 'string',
      JSON: 'Record<string, unknown>',
      BigInt: 'bigint',
    },
  }],
})
```

#### Input/output mapping

When input and output types differ:

```ts
export default defineConfig({
  schemas: [{
    schema: 'https://api.example.com/graphql',
    output: 'src/schema.ts',
    scalars: {
      Date: {
        input: 'string', // what you pass as a variable
        output: 'Date', // what you get back in results
      },
    },
  }],
})
```

## Complete example

```ts
import { defineConfig } from 'gazania/config'

export default defineConfig({
  schemas: [
    {
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
    },
  ],
  extract: {
    dir: 'src',
    output: 'dist/manifest.json',
    tsconfig: 'tsconfig.build.json',
  },
})
```

## Multiple schemas example

```ts
import { defineConfig } from 'gazania/config'

export default defineConfig({
  schemas: [
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
  ],
})
```
