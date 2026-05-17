# Gazania API

API reference for the `gazania` package.

## `createGazania`

Creates a typed GraphQL query builder from a schema definition.

### Signatures

```ts
function createGazania(): UnknownSchema
function createGazania<T extends DefineSchema<any, any>>(schema: T): TypedGazania<T>
function createGazania<T extends keyof Schemas>(url: T): TypedGazania<Schemas[T]>
function createGazania<T extends string>(url: T): UnknownSchema
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `schema` | `DefineSchema<any, any>` | A schema type definition (pass as `{} as Schema`) |
| `url` | `string` | A registered schema URL |

### Returns

A `Gazania` object with typed builder methods.

### Usage

```ts
import type { Schema } from './schema'
import { createGazania } from 'gazania'

// With schema type
const gazania = createGazania({} as Schema)

// With registered URL
const gazania = createGazania('https://api.example.com/graphql')

// Without schema (untyped)
const gazania = createGazania()
```

## `Gazania`

The builder object returned by `createGazania`. Provides methods for creating GraphQL operations.

### `gazania.query(name?)`

Creates a query operation builder.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `undefined` | Operation name |

Returns: [`OperationBuilderWithoutVars`](#operationbuilderwithoutvars)

### `gazania.mutation(name?)`

Creates a mutation operation builder.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `undefined` | Operation name |

Returns: [`OperationBuilderWithoutVars`](#operationbuilderwithoutvars)

### `gazania.subscription(name?)`

Creates a subscription operation builder.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `undefined` | Operation name |

Returns: [`OperationBuilderWithoutVars`](#operationbuilderwithoutvars)

### `gazania.fragment(name)`

Creates a fragment builder.

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Fragment name |

Returns: [`FragmentBuilder`](#fragmentbuilder)

### `gazania.partial(name)`

Creates a partial (reusable selection) builder.

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Partial name |

Returns: [`PartialBuilder`](#partialbuilder)

### `gazania.section(name)`

Creates a section builder. Sections behave like partials at runtime, but their result types are transparent instead of masked.

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Section name |

Returns: [`SectionBuilder`](#sectionbuilder)

### `gazania.enum(value)`

Creates a typed enum value for use in arguments.

| Parameter | Type | Description |
|---|---|---|
| `value` | `string` | Enum value |

Returns: `EnumPackage<T>` — A callable that returns the enum value.

---

## OperationBuilderWithoutVars

Builder for operations that haven't declared variables yet.

### `.vars(definitions)`

Declares variables for the operation.

| Parameter | Type | Description |
|---|---|---|
| `definitions` | `VariableDefinitions` | Object mapping variable names to GraphQL type strings |

Returns: [`OperationBuilderWithVars`](#operationbuilderwithvars)

```ts
gazania.query('Test')
  .vars({ id: 'Int!', name: 'String = "default"' })
```

### `.directives(fn)`

Adds operation-level directives.

| Parameter | Type | Description |
|---|---|---|
| `fn` | `() => DirectiveInput[]` | Function returning directive tuples |

Returns: `OperationBuilderWithoutVars`

```ts
gazania.query('Test')
  .directives(() => [['@cached', { ttl: 60 }]])
```

### `.select(callback)`

Executes the selection and builds the document.

| Parameter | Type | Description |
|---|---|---|
| `callback` | `($: RootDollar) => FieldDollar` | Selection callback |

Returns: `DocumentNode` (typed as `TypedDocumentNode`)

```ts
gazania.query('Test')
  .select($ => $.select(['id', 'name']))
```

---

## OperationBuilderWithVars

Builder for operations that have declared variables.

### `.directives(fn)`

Adds operation-level directives with access to variables.

| Parameter | Type | Description |
|---|---|---|
| `fn` | `(vars) => DirectiveInput[]` | Function receiving variables and returning directive tuples |

Returns: `OperationBuilderWithVars`

### `.select(callback)`

Executes the selection with access to variables.

| Parameter | Type | Description |
|---|---|---|
| `callback` | `($: RootDollar, vars) => FieldDollar` | Selection callback with variables |

Returns: `DocumentNode` (typed as `TypedDocumentNode`)

```ts
gazania.query('Test')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select(['name']),
  }]))
```

---

## FragmentBuilder

Builder for named GraphQL fragments.

### `.on(typeName)`

Specifies the type condition for the fragment.

| Parameter | Type | Description |
|---|---|---|
| `typeName` | `string` | The GraphQL type name |

Returns: `FragmentBuilderOnType`

### FragmentBuilderOnType

#### `.vars(definitions)`

Declares variables for the fragment.

Returns: `FragmentBuilderOnTypeWithVar`

#### `.directives(fn)`

Adds directives to the fragment definition.

| Parameter | Type | Description |
|---|---|---|
| `fn` | `() => DirectiveInput[]` | Function returning directive tuples |

Returns: `FragmentBuilderOnType`

```ts
gazania.fragment('UserFields')
  .on('User')
  .directives(() => [['@deprecated', { reason: 'use NewFields' }]])
  .select($ => $.select(['id', 'name', 'email']))
```

#### `.select(callback)`

Builds the fragment document.

Returns: `DocumentNode`

```ts
gazania.fragment('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))
```

### FragmentBuilderOnTypeWithVar

#### `.directives(fn)`

Adds directives to the fragment definition with access to variable proxies.

| Parameter | Type | Description |
|---|---|---|
| `fn` | `(vars) => DirectiveInput[]` | Function receiving variables and returning directive tuples |

Returns: `FragmentBuilderOnTypeWithVar`

#### `.select(callback)`

Builds the fragment document with variable access.

Returns: `DocumentNode`

---

## PartialBuilder

Builder for reusable selection partials.

### `.on(typeName)`

Specifies the type condition.

| Parameter | Type | Description |
|---|---|---|
| `typeName` | `string` | The GraphQL type name |

Returns: `PartialBuilderOnType`

### PartialBuilderOnType

#### `.vars(definitions)`

Declares variables for the partial.

Returns: `PartialBuilderOnTypeWithVar`

#### `.directives(fn)`

Adds directives to the fragment **definition** (not the spread site).

| Parameter | Type | Description |
|---|---|---|
| `fn` | `() => DirectiveInput[]` | Function returning directive tuples |

Returns: `PartialBuilderOnType`

```ts
const userPartial = gazania.partial('UserFields')
  .on('User')
  .directives(() => [['@deprecated', { reason: 'use newPartial' }]])
  .select($ => $.select(['id', 'name']))
```

#### `.select(callback)`

Builds the partial package.

Returns: `PartialPackage` — A function that can be spread into selections.

```ts
const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))

// Usage in a query
gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([...userPartial({})]),
  }]))
```

### PartialBuilderOnTypeWithVar

#### `.directives(fn)`

Adds directives to the fragment definition with access to variable proxies.

| Parameter | Type | Description |
|---|---|---|
| `fn` | `(vars) => DirectiveInput[]` | Function receiving variables and returning directive tuples |

Returns: `PartialBuilderOnTypeWithVar`

#### `.select(callback)`

Builds the partial package with variable access.

Returns: `PartialPackage`

---

## SectionBuilder

Builder for reusable selection sections.

### `.on(typeName)`

Specifies the type condition.

| Parameter | Type | Description |
|---|---|---|
| `typeName` | `string` | The GraphQL type name |

Returns: `SectionBuilderOnType`

### SectionBuilderOnType

#### `.vars(definitions)`

Declares variables for the section.

Returns: `SectionBuilderOnTypeWithVar`

#### `.directives(fn)`

Adds directives to the fragment definition (not the spread site).

| Parameter | Type | Description |
|---|---|---|
| `fn` | `() => DirectiveInput[]` | Function returning directive tuples |

Returns: `SectionBuilderOnType`

#### `.select(callback)`

Builds the section package.

Returns: `SectionPackage` — A function that can be spread into selections.

```ts
gazania.section('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
```

### SectionBuilderOnTypeWithVar

#### `.directives(fn)`

Adds directives to the fragment definition with access to variable proxies.

| Parameter | Type | Description |
|---|---|---|
| `fn` | `(vars) => DirectiveInput[]` | Function receiving variables and returning directive tuples |

Returns: `SectionBuilderOnTypeWithVar`

#### `.select(callback)`

Builds the section package with variable access.

Returns: `SectionPackage`

---

## FieldDollar

The dollar object available in field selection callbacks.

### `.args(arguments)`

Sets field arguments.

| Parameter | Type | Description |
|---|---|---|
| `arguments` | `ArgumentMap` | Object of argument key-value pairs |

Returns: `FieldDollar`

### `.select(selection)`

Sets the nested field selection.

| Parameter | Type | Description |
|---|---|---|
| `selection` | `SelectionInput` | Array of field selections |

Returns: `FieldDollar`

### `.directives(...directives)`

Adds one or more directives to the field.

| Parameter | Type | Description |
|---|---|---|
| `directives` | `DirectiveInput[]` | Directive tuples |

Returns: `FieldDollar`

### `.enum(value)`

Creates a typed enum value (convenience method).

| Parameter | Type | Description |
|---|---|---|
| `value` | `string` | Enum value |

Returns: `EnumPackage<T>`

---

## Type utilities

### `ResultOf<T>`

Extracts the result type from a `TypedDocumentNode`.

```ts
type Result = ResultOf<typeof myQuery>
```

### `VariablesOf<T>`

Extracts the variables type from a `TypedDocumentNode`.

```ts
type Variables = VariablesOf<typeof myQuery>
```

### `TypedDocumentNode<TResult, TVars>`

A `DocumentNode` that carries result and variable type information. Compatible with GraphQL clients that support typed documents.

---

## Types

### `DirectiveInput`

A directive is specified as a tuple:

```ts
type DirectiveInput = [name: string, args?: Record<string, unknown>]
```

### `VariableDefinitions`

Variable definitions are specified as an object mapping variable names to GraphQL type strings:

```ts
type VariableDefinitions = Record<string, string>
```

### `SelectionInput`

An array of field selections:

```ts
type SelectionInput = Array<string | SelectionObject>
```

### `SelectionObject`

An object mapping field names to selection values:

```ts
interface SelectionObject {
  [key: string]: true | ((dollar: FieldDollar) => FieldDollar)
}
```

### `Schemas`

Module augmentation interface for registering named schemas:

```ts
declare module 'gazania' {
  interface Schemas {
    'https://api.example.com/graphql': MySchema
  }
}
```

### `DefineSchema<Namespace, SchemaHash>`

The type emitted by `gazania generate` to represent a GraphQL schema in the TypeScript type system.

- **`Namespace`** — Maps GraphQL type names to their TypeScript representations.
- **`SchemaHash`** — A schema identity string injected by codegen. This allows Gazania to distinguish operations from different schemas in projects that use multiple schemas. The second parameter has a default value and does not need to be specified manually.

```ts
// Generated output (simplified):
export type Schema = DefineSchema<{
  Query: Type_Query
  User: Type_User
  // ...
}, 'sha256:...'>
```

---

## Extract API

Use the extract API for programmatic access to static query extraction. Import it from `gazania/extract`.

```ts
import { extract } from 'gazania/extract'
```

### `extract(options)`

Scans source files for Gazania operations and returns a persisted query manifest.

```ts
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { extract, parseTSConfig } from 'gazania/extract'
import ts from 'typescript'

const hash = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`
const parsed = parseTSConfig(ts, resolve('tsconfig.json'), ts.sys)

const { manifest, skipped } = await extract({
  dir: resolve('src'),
  tsconfig: parsed,
  hash,
})
```

If a Gazania call cannot be statically evaluated, `extract()` throws an `ExtractionError`. You can suppress specific failure types by passing `ignoreCategories`:

```ts
const { manifest, skipped } = await extract({
  dir: resolve('src'),
  tsconfig: parsed,
  hash,
  ignoreCategories: ['unresolved', 'circular'],
})
```

### `parseTSConfig(ts, tsconfigPath, system)`

Parses a tsconfig file into a `ts.ParsedCommandLine`. Re-exported from `gazania/extract` for convenience.

```ts
import { parseTSConfig } from 'gazania/extract'
import ts from 'typescript'

const parsed = parseTSConfig(ts, '/path/to/tsconfig.json', ts.sys)
```

### `ExtractionError`

Thrown when Gazania detects calls that it cannot statically evaluate.

```ts
try {
  await extract({ dir: resolve('src'), tsconfig: parsed, hash })
}
catch (err) {
  if (err instanceof ExtractionError) {
    for (const entry of err.skipped) {
      console.error(`${entry.file}:${entry.line}: ${entry.reason}`)
    }
  }
}
```

| Property | Type | Description |
|---|---|---|
| `skipped` | `SkippedExtraction[]` | Calls that failed extraction |

### `validateManifest(manifest, schema)`

Validates all operations in an extracted manifest against a GraphQL schema. For each operation, transitive fragment dependencies are resolved and merged into a single document so that fragment spreads are satisfied during validation.

```ts
import { validateManifest } from 'gazania/extract'
import { buildASTSchema, parse } from 'graphql'

const schema = buildASTSchema(parse(sdlString))
const { errors, warnings } = validateManifest(manifest, schema)

for (const e of errors) {
  console.error(`${e.loc.file}:${e.loc.start.line} ${e.message}`)
}
```

Returns `{ errors: ValidationError[], warnings: ValidationWarning[] }`.

- **Errors** — produced by GraphQL spec compliance rules (`specifiedRules`). These indicate queries that will fail at runtime (unknown fields, missing arguments, type mismatches, etc.).
- **Warnings** — produced by `NoDeprecatedCustomRule`. These indicate usage of deprecated fields.

### Types

#### `ValidationError`

| Property | Type | Description |
|---|---|---|
| `loc` | `SourceLoc` | Source location of the invalid operation |
| `message` | `string` | Validation error message |

#### `ValidationWarning`

| Property | Type | Description |
|---|---|---|
| `loc` | `SourceLoc` | Source location of the operation using a deprecated field |
| `message` | `string` | Deprecation warning message |

### Types

#### `ExtractOptions`

| Property | Type | Default | Description |
|---|---|---|---|
| `dir` | `string` | — | **(required)** Absolute path to directory to scan for source files |
| `include` | `string` | `'**/*.{ts,tsx,js,jsx,vue,svelte}'` | Glob pattern for files to include |
| `hash` | `(body: string) => string` | — | **(required)** Hash function for computing operation identifiers |
| `tsconfig` | `ts.ParsedCommandLine` | — | **(required)** Parsed TypeScript configuration. Use `parseTSConfig()` to create |
| `ignoreCategories` | `SkippedExtractionCategory[]` | `[]` | Categories of failures to suppress |
| `logger` | `ExtractLogger` | — | Logger for extraction diagnostics |
| `fs` | `ExtractFS` | `ts.sys` | File-system interface for all file operations |
| `createHost` | `CreateHostFn` | — | Override the default CompilerHost construction |

#### `ExtractFS`

Minimal synchronous file-system interface. `ts.sys` satisfies this interface in Node.js environments. All methods must be synchronous — for async environments, preload files into memory before calling `extract()`.

| Method | Required | Description |
|---|---|---|
| `readFile(path: string): string \| undefined` | Yes | Read file contents |
| `readDirectory(path, extensions?, excludes?, includes?, depth?): string[]` | Yes | Recursively list files in a directory. Should exclude `node_modules` and `.git` |
| `fileExists(path: string): boolean` | No | Check if a file exists. Falls back to `readFile(path) !== undefined` if not provided |

```ts
import { extract, parseTSConfig } from 'gazania/extract'
import ts from 'typescript'

// Use with a virtual file system
const vfs: Map<string, string> = new Map([
  ['/project/src/operations/GetUser.ts', '...'],
  ['/project/tsconfig.json', '{"compilerOptions":{"target":"esnext","module":"esnext","moduleResolution":"bundler"}}'],
])

const parsed = parseTSConfig(ts, '/project/tsconfig.json', {
  ...ts.sys,
  readFile: path => vfs.get(path),
  readDirectory: (dir, extensions) =>
    [...vfs.keys()].filter(k => k.startsWith(dir) && extensions?.some(e => k.endsWith(e))),
})

await extract({
  dir: '/project/src',
  tsconfig: parsed,
  hash,
  fs: {
    readFile: path => vfs.get(path),
    readDirectory: (dir, extensions) =>
      [...vfs.keys()].filter(k => k.startsWith(dir) && extensions?.some(e => k.endsWith(e))),
  },
})
```

#### `CreateHostFn`

Override the default `ts.CompilerHost` construction. Receives the resolved `ts.System` (assembled from `fs` + `ts.sys` defaults) and the parsed compiler options from tsconfig.

```ts
type CreateHostFn = (
  ts: typeof import('typescript'),
  system: import('typescript').System,
  compilerOptions: import('typescript').CompilerOptions,
) => import('typescript').CompilerHost
```

#### `ExtractResult`

| Property | Type | Description |
|---|---|---|
| `manifest` | `ExtractManifest` | The extracted manifest containing operations and fragments |
| `skipped` | `SkippedExtraction[]` | Gazania calls that were detected but not extracted |

#### `ManifestEntry`

| Property | Type | Description |
|---|---|---|
| `body` | `string` | The GraphQL operation or fragment body |
| `hash` | `string` | Body hash in `algorithm:hex` format |
| `loc` | `SourceLoc` | Source location in the original file |

#### `SourceLoc`

| Property | Type | Description |
|---|---|---|
| `file` | `string` | Absolute path of the source file |
| `start` | `SourceLocation` | Start position of the operation |
| `end` | `SourceLocation` | End position of the operation |

#### `SourceLocation`

| Property | Type | Description |
|---|---|---|
| `line` | `number` | 1-based line number |
| `column` | `number` | 1-based column number |
| `offset` | `number` | 0-based character offset from the start of the file |

#### `SkippedExtraction`

| Property | Type | Description |
|---|---|---|
| `file` | `string` | Absolute path of the file with the skipped call |
| `line` | `number` | 1-based line number |
| `reason` | `string` | Error message from the failed evaluation |
| `category` | `SkippedExtractionCategory` | Failure category |

#### `SkippedExtractionCategory`

```ts
type SkippedExtractionCategory = 'unresolved' | 'analysis' | 'circular'
```

- **`unresolved`** — A referenced partial, section, or variable could not be found.
- **`analysis`** — The builder chain could not be statically evaluated. This often happens when it depends on runtime values.
- **`circular`** — Circular reference detected between partials or sections.

