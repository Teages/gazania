# Multiple schemas

Gazania can work with multiple GraphQL schemas in the same project.

## Generating multiple schemas

Pass an array of schema configurations to the `schemas` field:

```ts
// gazania.config.ts
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

Then run once:

```sh
npx gazania generate
```

### Using CLI flags

Run the generate command for each schema:

```sh
npx gazania generate --schema https://api-a.example.com/graphql --output src/schema-a.ts
npx gazania generate --schema https://api-b.example.com/graphql --output src/schema-b.ts
```

## Using multiple schemas

Each generated schema file registers itself by URL via module augmentation. Create a separate `createGazania` instance for each:

```ts
import { createGazania } from 'gazania'

const apiA = createGazania('https://api-a.example.com/graphql')
const apiB = createGazania('https://api-b.example.com/graphql')

// Each instance is typed for its own schema
const usersQuery = apiA.query('GetUsers')
  .select($ => $.select([{
    users: $ => $.select(['id', 'name']),
  }]))

const productsQuery = apiB.query('GetProducts')
  .select($ => $.select([{
    products: $ => $.select(['id', 'title', 'price']),
  }]))
```

### Passing schema types directly

If you prefer, you can import and pass the schema type directly:

```ts
import type { Schema as SchemaA } from './schema-a'
import type { Schema as SchemaB } from './schema-b'
import { createGazania } from 'gazania'

const apiA = createGazania({} as SchemaA)
const apiB = createGazania({} as SchemaB)
```

## Named schema registration

Each generated schema file includes a module augmentation that registers the schema by its URL:

```ts
// Automatically included in schema-a.ts (generated)
declare module 'gazania' {
  interface Schemas {
    'https://api-a.example.com/graphql': SchemaA
  }
}

// Automatically included in schema-b.ts (generated)
declare module 'gazania' {
  interface Schemas {
    'https://api-b.example.com/graphql': SchemaB
  }
}
```
