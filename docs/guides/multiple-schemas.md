# Multiple schemas

Gazania can work with multiple GraphQL schemas in the same project.

## Generating multiple schemas

### Using a single config file (recommended)

Pass an array to `defineConfig` to generate all schemas in one run:

```ts
// gazania.config.ts
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

Import each schema and create separate `gazania` instances:

```ts
import type { Schema as SchemaA } from './schema-a'
import type { Schema as SchemaB } from './schema-b'
import { createGazania } from 'gazania'

const apiA = createGazania({} as SchemaA)
const apiB = createGazania({} as SchemaB)

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

## Named schema registration

You can register each schema by name using module augmentation:

```ts
// In schema-a.ts (generated)
declare module 'gazania' {
  interface Schemas {
    'https://api-a.example.com/graphql': SchemaA
  }
}

// In schema-b.ts (generated)
declare module 'gazania' {
  interface Schemas {
    'https://api-b.example.com/graphql': SchemaB
  }
}
```

Then use schemas by their registered names:

```ts
import { createGazania } from 'gazania'

const apiA = createGazania('https://api-a.example.com/graphql')
const apiB = createGazania('https://api-b.example.com/graphql')
