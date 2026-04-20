# Gazania CLI

The CLI provides commands for schema type generation and static query extraction.

## Installation

The CLI is included with the `gazania` package:

```sh
npm install gazania
```

## Usage

```
gazania <command> [options]
```

## Commands

### `generate`

Generate TypeScript type definitions from a GraphQL schema.

```
gazania generate [options]
```

#### Options

| Option | Alias | Type | Description |
|---|---|---|---|
| `--schema <source>` | `-s` | `string` | Schema source: URL or file path (overrides config) |
| `--output <path>` | `-o` | `string` | Output file path (overrides config) |
| `--config <path>` | `-c` | `string` | Path to config file |
| `--silent` | | `boolean` | Suppress output |
| `--help` | `-h` | | Show help |

#### Examples

**From a GraphQL URL:**

```sh
npx gazania generate --schema https://api.example.com/graphql --output src/schema.ts
```

**From a local GraphQL file:**

```sh
npx gazania generate --schema schema.graphql --output src/schema.ts
```

**From an introspection JSON file:**

```sh
npx gazania generate --schema introspection.json --output src/schema.ts
```

**Using a config file:**

```sh
npx gazania generate
```

**Using a specific config file:**

```sh
npx gazania generate --config gazania.config.a.ts
```

**Override config values:**

```sh
npx gazania generate --schema https://other-api.com/graphql
npx gazania generate --output src/other-schema.ts
```

### Global Options

| Option | Alias | Description |
|---|---|---|
| `--help` | `-h` | Show help |
| `--version` | `-v` | Show version |

---

### `extract`

Extract all Gazania GraphQL operations and produce a persisted query manifest.

```
gazania extract [options]
```

The command scans your source files, finds all Gazania builder chains that produce a `DocumentNode`, evaluates them at analysis time, and writes a JSON manifest with each operation's body and SHA-256 hash. Vue (`.vue`) and Svelte (`.svelte`) single-file components are supported — each `<script>` block is extracted and processed independently.

#### Options

| Option | Alias | Type | Default | Description |
|---|---|---|---|---|
| `--dir <path>` | `-d` | `string` | `src` | Directory to scan |
| `--output <path>` | `-o` | `string` | `gazania-manifest.json` | Output manifest file path |
| `--include <glob>` | | `string` | `**/*.{ts,tsx,js,jsx,vue,svelte}` | File pattern to include |
| `--algorithm <alg>` | | `string` | `sha256` | Hash algorithm |
| `--tsconfig <path>` | | `string` | | Path to TypeScript config file for cross-file partial/section resolution |
| `--silent` | | `boolean` | `false` | Suppress output |
| `--help` | `-h` | | | Show help |

#### Examples

**Use defaults (scan `src/`, write `gazania-manifest.json`):**

```sh
npx gazania extract
```

**Scan a custom directory:**

```sh
npx gazania extract --dir app
```

**Custom output path:**

```sh
npx gazania extract --output dist/persisted-queries.json
```

**Use SHA-512 hashes:**

```sh
npx gazania extract --algorithm sha512
```

#### Manifest format

```json
{
  "operations": {
    "FetchAnime": {
      "body": "query FetchAnime($id: Int = 127549) { ... }",
      "hash": "sha256:a1b2c3d4..."
    }
  },
  "fragments": {
    "UserFields": {
      "body": "fragment UserFields on User { id name email }",
      "hash": "sha256:e5f6a7b8..."
    }
  }
}
```

See [Persisted Queries](/guides/persisted-queries) for a full guide on using this manifest with your GraphQL server.

## Schema sources

The `--schema` option accepts:

| Source Type | Example |
|---|---|
| HTTP/HTTPS URL | `https://api.example.com/graphql` |
| Local `.graphql` file | `schema.graphql` or `./path/to/schema.gql` |
| Local `.json` file | `introspection.json` |

For more advanced schema sources (custom headers, inline SDL, getter functions), use a [config file](/reference/config-format).

## Config file discovery

When no `--config` is specified, the CLI looks for config files in the current directory:

1. `gazania.config.ts`
2. `gazania.config.js`

::: info TypeScript config
TypeScript config files (`.ts`) need Node.js 22.6+ with native TypeScript support. On older versions, use `gazania.config.js`, or pass `--experimental-strip-types` on Node.js 22.6--23.5.
:::

## Priority

When both config file values and CLI flags are provided:

1. CLI flags override config file values for `--schema` and `--output`
2. If both `--schema` and `--output` are provided via CLI, no config file is loaded
3. If only one is provided via CLI, a config file is still required for the missing value
4. `--schema` and `--output` flags **cannot** be used when the config file exports an array of schemas; use `--config` to point to a single-schema config file instead
