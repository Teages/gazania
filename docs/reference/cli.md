# Gazania CLI

The CLI generates TypeScript types from a GraphQL schema.

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
