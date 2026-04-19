# Build Transform Plugin

The `gazania/transform` plugin evaluates Gazania builder calls at build time and replaces them with pre-computed `DocumentNode` JSON. This eliminates any runtime overhead from the builder and removes the dependency on the `graphql` package in your client bundles.

## How it works

Gazania builder chains are pure and deterministic — the same source code always produces the same GraphQL document. The plugin exploits this by:

1. Parsing each source file's AST at build time
2. Finding builder chains that end in `.select(...)`
3. Evaluating them in a sandboxed Node.js VM context
4. Replacing the expression in-place with the resulting `DocumentNode` JSON literal

If a builder chain references external runtime values (e.g. a variable computed at runtime), the plugin silently leaves it unchanged — the runtime builder is still there as a fallback.

## Installation

The plugin is included in the `gazania` package — no extra installation is needed.

## Setup

::: code-group

```ts [vite.config.ts]
import { vite as gazaniaTransform } from 'gazania/transform'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [gazaniaTransform()],
})
```

```ts [rollup.config.ts]
import { rollup as gazaniaTransform } from 'gazania/transform'

export default {
  plugins: [gazaniaTransform()],
}
```

```ts [webpack.config.ts]
import { webpack as gazaniaTransform } from 'gazania/transform'

export default {
  plugins: [gazaniaTransform()],
}
```

```ts [rspack.config.ts]
import { rspack as gazaniaTransform } from 'gazania/transform'

export default {
  plugins: [gazaniaTransform()],
}
```

:::

The following bundler plugins are available as named exports from `gazania/transform`:

| Export | Bundler |
|---|---|
| `vite` | Vite |
| `rollup` | Rollup |
| `rolldown` | Rolldown |
| `webpack` | Webpack |
| `rspack` | Rspack |
| `esbuild` | esbuild |
| `farm` | Farm |

The default export (`GazaniaTransformPlugin`) is the raw `UnpluginInstance` for use with `unplugin` directly.

## What gets transformed

The plugin transforms any Gazania builder chain that:

1. Imports `gazania` or `createGazania` from the `'gazania'` package
2. Ends with a `.select(...)` call that produces a `DocumentNode`

**Before transform:**

```ts
import { gazania } from 'gazania'

const fetchAnime = gazania.query('FetchAnime')
  .vars({ id: 'Int = 127549' })
  .select(($, vars) => $.select([{
    Media: $ => $.args({ id: vars.id, type: $.enum('ANIME') })
      .select([
        'id',
        {
          title: $ => $.select(['romaji', 'english', 'native']),
        },
      ]),
  }]))
```

**After transform:**

```ts
import { gazania } from 'gazania'

const fetchAnime = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FetchAnime"},...}]}
```

The import declaration is left as-is (tree-shaking will eliminate it if it becomes unused).

## `createGazania` usage

The plugin also handles the `createGazania` pattern:

```ts
import { createGazania } from 'gazania'

const schema = createGazania('https://api.example.com/graphql')

// This chain is correctly transformed
const query = schema.query('MyQuery')
  .select($ => $.select(['id', 'name']))
```

## Options

```ts
interface GazaniaTransformOptions {
  /**
   * Custom include filter for files to transform.
   * By default, transforms `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` files
   * and Vue `<script>` blocks.
   */
  include?: (id: string) => boolean
}
```

### Custom include filter

To restrict transformation to specific files:

```ts
import { vite as gazaniaTransform } from 'gazania/transform'

export default defineConfig({
  plugins: [
    gazaniaTransform({
      include: id => id.includes('/src/queries/'),
    }),
  ],
})
```

## Behavior notes

- **Dynamic values**: Builder chains that reference variables computed at runtime are silently skipped. The runtime builder handles them as normal.
- **Fragments and partials**: When a `query` or `mutation` uses partials, the full document (including fragment definitions) is inlined into the replacement JSON. The partial builder itself is left as runtime code.
- **Source maps**: The plugin uses `magic-string` to produce accurate source maps, so debugging and error messages remain correct after transformation.
- **TypeScript types**: The replacement is a plain JSON object literal that still satisfies the `TypedDocumentNode` type, so no type assertions are needed.
