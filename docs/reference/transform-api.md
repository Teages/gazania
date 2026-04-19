# Transform Plugin API

API reference for `gazania/transform`.

## Plugin factory

```ts
import GazaniaTransformPlugin from 'gazania/transform'
```

The default export is the raw `UnpluginInstance`. Call it to create the plugin for your bundler.

## Framework-specific exports

Named exports for each supported bundler:

```ts
import {
  vite,
  rollup,
  rolldown,
  webpack,
  rspack,
  esbuild,
  farm,
} from 'gazania/transform'
```

| Export | Type | Bundler |
|---|---|---|
| `vite` | `(options?) => VitePlugin` | Vite |
| `rollup` | `(options?) => RollupPlugin` | Rollup |
| `rolldown` | `(options?) => RolldownPlugin` | Rolldown |
| `webpack` | `(options?) => WebpackPlugin` | Webpack |
| `rspack` | `(options?) => RspackPlugin` | Rspack |
| `esbuild` | `(options?) => EsbuildPlugin` | esbuild |
| `farm` | `(options?) => FarmPlugin` | Farm |

## `GazaniaTransformOptions`

```ts
interface GazaniaTransformOptions {
  include?: (id: string) => boolean
}
```

### `include`

A custom filter function. Receives a module ID (file path, possibly with a query string) and returns `true` if the module should be transformed.

**Default behavior** (when not specified): transforms files matching `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, and Vue `<script>` blocks (detected via `?type=script` query).

**Example:**

```ts
import { vite as gazaniaTransform } from 'gazania/transform'

export default defineConfig({
  plugins: [
    gazaniaTransform({
      include: id => /\/queries\//.test(id),
    }),
  ],
})
```
