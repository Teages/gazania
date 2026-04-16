# Gazania API

API reference for the `gazania` package.

## `createGazania`

Creates a typed GraphQL query builder from a schema definition.

### Signatures

```ts
function createGazania(): UnknownSchema
function createGazania<T extends DefineSchema<any>>(schema: T): TypedGazania<T>
function createGazania<T extends keyof Schemas>(url: T): TypedGazania<Schemas[T]>
function createGazania<T extends string>(url: T): UnknownSchema
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `schema` | `DefineSchema<any>` | A schema type definition (pass as `{} as Schema`) |
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
    user: $ => $.select([...userPartial($)]),
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

### `.withDirective(...directives)`

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
