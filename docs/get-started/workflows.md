# Workflows

How to generate schema types and configure Gazania in your project.

## Schema generation

Gazania needs TypeScript types that match your GraphQL schema. The CLI generates these from any schema source.

### From a URL

Generate types from a running GraphQL endpoint:

```sh
npx gazania generate --schema https://api.example.com/graphql --output src/schema.ts
```

### From a local file

Generate from a `.graphql` or `.gql` file:

```sh
npx gazania generate --schema schema.graphql --output src/schema.ts
```

### From introspection JSON

Generate from a JSON introspection result:

```sh
npx gazania generate --schema introspection.json --output src/schema.ts
```

## Configuration file

For repeated use, create a `gazania.config.ts` (or `gazania.config.js`) file in your project root:

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

Then run the generate command without arguments:

```sh
npx gazania generate
```

### Custom scalar mappings

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
        BigInt: {
          input: 'string',
          output: 'string',
        },
      },
    },
  ],
})
```

When a scalar mapping is a string, it applies to both input and output positions. Use the `{ input, output }` form when they differ.

### Schema source options

The `schema` field in the config supports multiple formats:

| Source | Example |
|---|---|
| URL | `'https://api.example.com/graphql'` |
| Local file | `'./schema.graphql'` |
| URL with options | `{ url: 'https://...', headers: { Authorization: 'Bearer ...' } }` |
| SDL string | `{ sdl: 'type Query { hello: String }' }` |
| JSON string | `{ json: '{ "data": { "__schema": ... } }' }` |
| Custom getter | `() => fetchSchemaSDL()` |

### URL with custom headers

For authenticated endpoints:

```ts
import { defineConfig } from 'gazania/config'

export default defineConfig({
  schemas: [
    {
      schema: {
        url: 'https://api.example.com/graphql',
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      },
      output: 'src/schema.ts',
    },
  ],
})
```

## Programmatic API

You can also use the codegen API in build scripts:

```ts
import { writeFile } from 'node:fs/promises'
import { generate } from 'gazania/codegen'

const sdl = `type Query { hello: String }`

const code = generate({
  source: sdl,
  scalars: {
    DateTime: 'string',
  },
})

await writeFile('src/schema.ts', code)
```

`generate()` accepts a `GenerateConfig` object with a `source` field (SDL string, introspection JSON string, or `GraphQLSchema` object), plus optional `scalars` and `url` fields. For loading schemas from URLs or files, use the CLI.

## Typical project setup

1. **Add a config file**: create `gazania.config.ts` with your schema source and output path.
2. **Generate types**: run `npx gazania generate` to produce the schema types.
3. **Use in code**: build queries using the schema URL:

    ```ts
    import { createGazania } from 'gazania'

    const gazania = createGazania('https://api.example.com/graphql')

    const query = gazania.query('GetUser')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select(['id', 'name']),
      }]))
    ```

4. **Regenerate on schema changes**: re-run the generate command when the schema changes.

::: warning Do not commit the generated schema file
Add the generated file to `.gitignore` and regenerate it automatically in your build or CI pipeline. The format of generated schema files is **not** a stability guarantee — it may change in any Gazania release. Only the runtime API (`gazania.query()`, `QueryResult`, `createGazania`, etc.) follows semver.

```
# .gitignore
src/schema.ts
```
:::

::: tip
Add `npx gazania generate` to your build scripts or CI pipeline to ensure types stay in sync with the schema.
:::
