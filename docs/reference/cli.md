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

The command scans your source files, finds all Gazania builder chains that produce a `DocumentNode` using type-aware detection, evaluates them at analysis time, and outputs a JSON manifest with each operation's body and SHA-256 hash. Vue (`.vue`) and Svelte (`.svelte`) single-file components are supported — each `<script>` block is extracted and processed independently.

A `tsconfig.json` is **required** — Gazania uses the type-aware detection to detect builder identifiers by type, supporting re-exported, aliased, and factory-created builders.

#### Options

| Option | Alias | Type | Default | Description |
|---|---|---|---|---|
| `--dir <path>` | `-d` | `string` | `src` | Directory to scan |
| `--output <path>` | `-o` | `string` | stdout | Output file path. Use `-` for explicit stdout |
| `--include <glob>` | | `string` | `**/*.{ts,tsx,js,jsx,vue,svelte}` | File pattern to include |
| `--algorithm <alg>` | | `string` | `sha256` | Hash algorithm |
| `--tsconfig <path>` | | `string` | | **(required)** Path to TypeScript config file |
| `--silent` | | `boolean` | `false` | Suppress progress output (errors still shown) |
| `--ignore-unresolved` | | `boolean` | `false` | Skip unresolved reference errors |
| `--ignore-analysis` | | `boolean` | `false` | Skip analysis failure errors |
| `--ignore-circular` | | `boolean` | `false` | Skip circular reference errors |
| `--ignore-all` | | `boolean` | `false` | Skip all extraction errors |
| `--no-emit` | | `boolean` | `false` | Suppress manifest output (useful for validation) |
| `--schema <path>` | `-s` | `string` | | Schema for query validation (file path, URL, or SDL string) |
| `--strict` | | `boolean` | `false` | Treat validation warnings (deprecated fields) as errors |
| `--help` | `-h` | | | Show help |

#### Examples

**Basic usage (stdout):**

```sh
npx gazania extract --tsconfig tsconfig.json
```

**Write to a file:**

```sh
npx gazania extract --output dist/persisted-queries.json --tsconfig tsconfig.json
```

**Scan a custom directory:**

```sh
npx gazania extract --dir app --tsconfig tsconfig.json
```

**Explicit stdout:**

```sh
npx gazania extract --output - --tsconfig tsconfig.json
```

**Use SHA-512 hashes:**

```sh
npx gazania extract --algorithm sha512 --tsconfig tsconfig.json
```

**Ignore unresolved references:**

```sh
npx gazania extract --ignore-unresolved --tsconfig tsconfig.json
```

**Ignore all extraction errors:**

```sh
npx gazania extract --ignore-all --tsconfig tsconfig.json
```

**Validation only (no output):**

```sh
npx gazania extract --no-emit --tsconfig tsconfig.json
```

**Validate queries against a schema:**

```sh
npx gazania extract --schema schema.graphql --no-mit --tsconfig tsconfig.json
```

**Strict validation (deprecated fields cause errors):**

```sh
npx gazania extract --schema schema.graphql --strict --no-emit --tsconfig tsconfig.json
```

#### Manifest format

```json
{
  "operations": {
    "FetchAnime": {
      "body": "query FetchAnime($id: Int = 127549) { ... }",
      "hash": "sha256:a1b2c3d4...",
      "loc": {
        "file": "/project/src/queries/FetchAnime.ts",
        "start": { "line": 10, "column": 1, "offset": 245 },
        "end": { "line": 15, "column": 2, "offset": 412 }
      }
    }
  },
  "fragments": {
    "UserFields": {
      "body": "fragment UserFields on User { id name email }",
      "hash": "sha256:e5f6a7b8...",
      "loc": {
        "file": "/project/src/fragments/UserFields.ts",
        "start": { "line": 3, "column": 14, "offset": 88 },
        "end": { "line": 3, "column": 52, "offset": 126 }
      }
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
