# Selections

How to pick fields, pass arguments, and compose queries in Gazania's selection system.

## The dollar object

The `$` parameter in `.select()` callbacks represents the current type. It has methods for building the selection:

```ts
gazania.query('MyQuery')
  .select($ => $.select([
    // $ represents the root Query type
    'field1',
    'field2',
  ]))
```

### Root dollar vs field dollar

- **Root dollar** (`$` in `.select()` on builders): the root operation type (Query, Mutation, or Subscription). Has `.select()`.
- **Field dollar** (`_` in field callbacks): a specific field. Has `.args()`, `.select()`, `.directives()`, and `.enum()`.

## Scalar fields

Select scalar fields by name as strings in the selection array:

```ts
$.select(['id', 'name', 'email', '__typename'])
```

When a field callback returns a dollar without calling `.select()`, the field is treated as a scalar:

```ts
$.select([{
  hello: $ => $.args({ name: 'world' }),
  // hello is scalar — no .select() needed
}])
```

## Object fields

Select object fields by providing a callback that calls `.select()`:

```ts
$.select([{
  user: $ => $.select(['id', 'name', {
    address: a => a.select(['city', 'country']),
  }]),
}])
```

The callback receives a field dollar for the object type, letting you nest selections as deeply as needed.

## Field arguments

Use `.args()` to pass arguments to a field:

```ts
$.select([{
  user: $ => $.args({ id: 1 }).select(['id', 'name']),
}])
```

### Argument types

Arguments can be:

| Type | Example | Description |
|---|---|---|
| Literal value | `{ limit: 10 }` | Inline constant |
| Variable reference | `{ id: vars.id }` | Reference to a declared variable |
| Enum value | `{ status: gazania.enum('ACTIVE') }` | Enum constant |
| Nested object | `{ input: { name: 'test' } }` | Input object type |
| Null | `{ value: null }` | Explicit null value |

### Chaining args with select

For object fields, chain `.args()` before `.select()`:

```ts
$.select([{
  users: $ => $.args({ limit: 10, offset: 0 }).select([
    'id',
    'name',
  ]),
}])
```

## Directives

### Field-level directives

Add directives to fields with `.directives()`:

```ts
$.select([{
  email: $ => $.directives(['@include', { if: true }]),
}])
```

The directive syntax is a tuple of `[directiveName, arguments?]`:

```ts
[
  ['@skip', { if: true }], // @skip(if: true)
  ['@include', { if: false }], // @include(if: false)
  ['@cached', { ttl: 60 }], // @cached(ttl: 60)
  ['@deprecated'], // @deprecated (no args)
]
```

Multiple directives can be chained:

```ts
$.select([{
  field: $ => $
    .directives(['@skip', { if: true }])
    .directives(['@cached', { ttl: 30 }]),
}])
```

### Directives with variables

Directive arguments can reference variables:

```ts
gazania.query('ConditionalQuery')
  .vars({ includeEmail: 'Boolean!' })
  .select(($, vars) => $.select([
    'id',
    'name',
    {
      email: $ => $.directives(['@include', { if: vars.includeEmail }]),
    },
  ]))
```

## Inline fragments

Use the `'... on TypeName'` syntax for inline fragments on union or interface types:

```ts
$.select([{
  searchResults: $ => $.select([
    '__typename',
    {
      '... on User': u => u.select(['id', 'name']),
      '... on Post': p => p.select(['id', 'title', 'body']),
    },
  ]),
}])
```

This produces:

```graphql
searchResults {
  __typename
  ... on User {
    id
    name
  }
  ... on Post {
    id
    title
    body
  }
}
```

## Aliases

Create field aliases using the `'alias: fieldName'` syntax:

```ts
$.select([{
  'firstUser: user': $ => $.args({ id: 1 }).select(['name']),
  'secondUser: user': $ => $.args({ id: 2 }).select(['name']),
}])
```

This produces:

```graphql
firstUser: user(id: 1) {
  name
}
secondUser: user(id: 2) {
  name
}
```

## Enum values

Within field callbacks, you can also access `.enum()` from the field dollar:

```ts
$.select([{
  sayings: $ => $.args({ category: $.enum('funny') }).select([
    'id',
    'content',
  ]),
}])
```

This is equivalent to using `gazania.enum()` but conveniently accessible within the selection context.

## Mixing selection styles

The selection array can freely mix strings and objects:

```ts
$.select([
  'id', // scalar by name
  '__typename', // scalar by name
  {
    'user': $ => $.select(['name']), // object field
    'alias: field': $ => $.args({ x: 1 }), // aliased scalar with args
  },
])
```
