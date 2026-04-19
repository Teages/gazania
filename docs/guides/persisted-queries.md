# Persisted Queries

Persisted queries (also known as trusted documents or query allowlists) are a security and performance technique where GraphQL operations are pre-registered with the server. Instead of sending the full query string, clients send a short hash identifier. The server looks up the operation from its allowlist.

Gazania includes a CLI command to extract all your query definitions and export them as a manifest file that can be uploaded to your server's allowlist.

## The `gazania extract` command

The `extract` command scans your source files, finds all Gazania builder calls, evaluates them at analysis time, and writes a JSON manifest containing each operation's body and hash.

```sh
npx gazania extract
```

By default this scans `src/` and writes `gazania-manifest.json` in the current directory.

## Manifest format

```json
{
  "operations": {
    "FetchAnime": {
      "body": "query FetchAnime($id: Int = 127549) {\n  Media(id: $id, type: ANIME) {\n    id\n    title {\n      romaji\n      english\n      native\n    }\n  }\n}",
      "hash": "sha256:a1b2c3d4..."
    },
    "CreateUser": {
      "body": "mutation CreateUser($input: CreateUserInput!) { ... }",
      "hash": "sha256:e5f6a7b8..."
    }
  },
  "fragments": {
    "UserFields": {
      "body": "fragment UserFields on User {\n  id\n  name\n  email\n}",
      "hash": "sha256:c9d0e1f2..."
    }
  }
}
```

Operations (queries, mutations, subscriptions) go into `operations`. Named fragments go into `fragments`.

## Options

```
gazania extract [options]

Options:
  -d, --dir <path>       Directory to scan (default: src)
  -o, --output <path>    Output manifest file path (default: gazania-manifest.json)
  --include <glob>       File glob pattern to include (default: **/*.{ts,tsx,js,jsx})
  --algorithm <alg>      Hash algorithm (default: sha256)
  --silent               Suppress output
  -h, --help             Show help
```

### Examples

**Use defaults:**

```sh
npx gazania extract
```

**Scan a different directory:**

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

## Typical workflow

### 1. Add extract to your build

Run `gazania extract` as part of your CI or build pipeline, after TypeScript compilation:

```json
{
  "scripts": {
    "build": "tsc && gazania extract",
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

- **Static analysis only**: The extractor evaluates builder calls in a sandboxed VM. Builder chains that depend on runtime values are silently skipped.
- **TypeScript files**: On Node.js 22.6+, TypeScript files are stripped of types before parsing. On older Node.js versions, only plain JavaScript files are scanned. For best results, run `extract` on Node.js 22.6+.
- **Anonymous operations**: Unnamed operations receive an auto-generated key based on the first 8 hex characters of their hash (e.g. `Anonymous_a1b2c3d4`).
- **Deduplication**: If the same operation name appears multiple times across files, the last one wins. Use unique operation names to avoid conflicts.
