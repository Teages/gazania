# Persisted Queries

Persisted queries (also known as trusted documents or query allowlists) are a security and performance technique where GraphQL operations are pre-registered with the server. Instead of sending the full query string, clients send a short hash identifier. The server looks up the operation from its allowlist.

Gazania includes a CLI command to extract all your query definitions and export them as a manifest file that can be uploaded to your server's allowlist.

## The `gazania extract` command

The `extract` command scans your source files, finds all Gazania builder calls using type-aware detection, evaluates them at analysis time, and writes a JSON manifest containing each operation's body and hash.

```sh
npx gazania extract --tsconfig tsconfig.json
```

A `tsconfig.json` is **required** — Gazania uses type-aware detection to detect builder identifiers by type (including re-exported, aliased, and factory-created builders), not by import string matching.

By default this scans `src/` and outputs the manifest to stdout. Use `--output <path>` to write to a file.

## Manifest format

```json
{
  "operations": {
    "FetchAnime": {
      "body": "query FetchAnime($id: Int = 127549) {\n  Media(id: $id, type: ANIME) {\n    id\n    title {\n      romaji\n      english\n      native\n    }\n  }\n}",
      "hash": "sha256:a1b2c3d4...",
      "loc": {
        "start": { "line": 10, "column": 1, "offset": 245 },
        "end": { "line": 15, "column": 2, "offset": 412 }
      }
    },
    "CreateUser": {
      "body": "mutation CreateUser($input: CreateUserInput!) { ... }",
      "hash": "sha256:e5f6a7b8...",
      "loc": {
        "start": { "line": 20, "column": 1, "offset": 600 },
        "end": { "line": 25, "column": 2, "offset": 820 }
      }
    }
  },
  "fragments": {
    "UserFields": {
      "body": "fragment UserFields on User {\n  id\n  name\n  email\n}",
      "hash": "sha256:c9d0e1f2...",
      "loc": {
        "start": { "line": 3, "column": 14, "offset": 88 },
        "end": { "line": 3, "column": 52, "offset": 126 }
      }
    }
  }
}
```

Each entry includes a `loc` field with `start` and `end` source positions. Each position contains `line` (1-based), `column` (1-based), and `offset` (0-based character offset from file start).

Operations (queries, mutations, subscriptions) go into `operations`. Named fragments go into `fragments`.

## Partials and sections

The extractor understands `gazania.partial()` and `gazania.section()` builders and includes their generated fragments in the manifest.

**Same-file** partials and sections are resolved automatically.

**Cross-file** partials and sections — where a partial defined in one file is imported and spread into a query in another file — are resolved via TypeScript module resolution. Files are processed in dependency order so that evaluated partials and sections are available when the importer files are evaluated.

### tsconfig requirements

The `--tsconfig` flag is **required** for all extraction. Your `tsconfig.json` must include all source files that contain partials, sections, or operations you want to extract. A minimal example:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
```

If your project already has a `tsconfig.json`, you can point directly to it.

## Options

```
gazania extract [options]

Options:
  -d, --dir <path>       Directory to scan (default: src)
  -o, --output <path>    Output manifest file path, use - for stdout (default: stdout)
  --include <glob>       File glob pattern to include (default: **/*.{ts,tsx,js,jsx,vue,svelte})
  --algorithm <alg>      Hash algorithm (default: sha256)
  --tsconfig <path>      (required) Path to tsconfig.json
  --silent               Suppress progress output (errors still shown)
  --ignore-unresolved    Skip unresolved reference errors
  --ignore-analysis      Skip analysis failure errors
  --ignore-circular      Skip circular reference errors
  --ignore-all           Skip all extraction errors
  --noEmit               Suppress manifest output (useful for validation)
  -h, --help             Show help
```

### Examples

**Basic usage (outputs to stdout):**

```sh
npx gazania extract --tsconfig tsconfig.json
```

**Write to a file:**

```sh
npx gazania extract --output dist/persisted-queries.json --tsconfig tsconfig.json
```

**Scan the selected directory:**

```sh
npx gazania extract --dir app --tsconfig tsconfig.json
```

**Use SHA-512 hashes:**

```sh
npx gazania extract --algorithm sha512 --tsconfig tsconfig.json
```

**Ignore all extraction errors:**

```sh
npx gazania extract --ignore-all --tsconfig tsconfig.json
```

**Validation only (no output):**

```sh
npx gazania extract --noEmit --tsconfig tsconfig.json
```

## Typical workflow

### 1. Add extract to your build

Run `gazania extract` as part of your CI or build pipeline, after TypeScript compilation:

```json
{
  "scripts": {
    "build": "tsc && gazania extract --tsconfig tsconfig.json --output dist/manifest.json",
    "generate": "gazania generate"
  }
}
```

### 2. Upload the manifest to your server

How you register the manifest depends on your GraphQL server. Most frameworks have a concept of a "trusted document store" or "persisted query allowlist". Provide the manifest as-is or transform it to your server's expected format.

For example, with Apollo Server's automatic persisted queries (APQ) or Envelop's `usePersistedOperations` plugin, you load the operations as a map of `{ hash: body }`.

### 3. Configure your client to send hashes

Instead of sending the full query string, your GraphQL client sends the hash. The exact configuration depends on your client library.

::: tip Choco, URQL, Apollo Client
Each client has a different mechanism for persisted queries. Consult your client's documentation for how to enable hash-based operation sending.
:::

## Behavior notes

- **Type-aware detection**: The extractor uses type-aware detection to identify Gazania builders by their type (via the `~isGazania` marker). This means re-exported, aliased, and factory-created builders (`import { g } from './utils'`, `const g = createGazania()`) are all detected correctly.
- **Static analysis only**: The extractor evaluates builders with static analysis. Dynamic code patterns that can't be resolved at analysis time (e.g. external variables) won't be included in the manifest.
- **Vue and Svelte**: `.vue` and `.svelte` files are supported. The extractor parses each `<script>` block (including `<script setup>` and `<script context="module">`) separately and treats them as independent JS/TS modules.
- **Anonymous operations**: Unnamed operations receive an auto-generated key based on the first 8 hex characters of their hash (e.g. `Anonymous_a1b2c3d4`).
- **Duplicate names**: If the same operation or fragment name is defined in multiple files with different bodies, extraction fails with an error. If the bodies are identical, the duplicate is silently skipped.
- **Error handling**: By default, extraction fails when any Gazania call cannot be statically evaluated (unresolved references, analysis failures, circular partials). Use `--ignore-*` flags to suppress specific error categories.
