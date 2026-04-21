# Building Queries

## Operations

### Query

```ts
const simpleQuery = gazania.query('SimpleQuery')
  .select($ => $.select(['hello', '__typename']))
```

### Mutation

```ts
const addItem = gazania.mutation('AddItem')
  .vars({ name: 'String!', categoryId: 'Int!' })
  .select(($, vars) => $.select([{
    addItem: $ => $.args({ name: vars.name, categoryId: vars.categoryId })
      .select(['id', 'name']),
  }]))
```

### Subscription

```ts
const countdown = gazania.subscription('Countdown')
  .vars({ from: 'Int!' })
  .select(($, vars) => $.select([{
    countdown: $ => $.args({ from: vars.from }),
  }]))
```

## Variables

Declare variables with `.vars()` using GraphQL type strings. Reference them via the second parameter of the `.select()` callback.

```ts
const userQuery = gazania.query('GetUser')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select(['id', 'name', 'email']),
  }]))
```

### Variable type strings

| Type string | GraphQL type | TypeScript type |
|---|---|---|
| `'String'` | `String` | `string \| null \| undefined` |
| `'String!'` | `String!` | `string` |
| `'[String!]!'` | `[String!]!` | `string[]` |
| `'Int = 42'` | `Int = 42` | `number \| null \| undefined` |
| `'Boolean!'` | `Boolean!` | `boolean` |

Variables with a default value or without `!` are optional in the resulting TypeScript type.

## Selection syntax

`.select()` takes an array with this exact structure:

- **Leading elements**: scalar field strings only (`'id'`, `'name'`, `'__typename'`)
- **Final element (optional)**: one object that maps field names to callbacks for nested selections or arguments

When you need multiple nested fields, put all of them in that single final object.

The `$` in a field callback is a **field dollar** with `.args()`, `.select()`, `.directives()`, and `.enum()`:

```ts
$.select(['id', 'name', {
  address: a => a.select(['city', 'country']), // nested object
  hello: $ => $.args({ name: 'world' }), // scalar with args (no .select() needed)
}])

$.select(['id', 'name', '__typename', {
  profile: p => p.select(['avatarUrl']),
  stats: s => s.select(['followers', 'following']),
}])
```

### Nested selections

```ts
const usersQuery = gazania.query('GetUsers')
  .select($ => $.select([{
    users: $ => $.select(['id', 'name', {
      friends: f => f.select(['id', 'name']),
    }]),
  }]))
```

### Field arguments

```ts
$.select([{
  users: $ => $.args({ limit: 10, offset: 0 }).select(['id', 'name']),
}])
```

Argument values can be:

| Kind | Example |
|---|---|
| Literal | `{ limit: 10 }` |
| Variable | `{ id: vars.id }` |
| Enum | `{ status: gazania.enum('ACTIVE') }` or `{ status: $.enum('ACTIVE') }` |
| Input object | `{ input: { name: vars.name } }` |
| Null | `{ value: null }` |

### Aliases

Use `'alias: fieldName'` as the object key:

```ts
$.select([{
  'firstUser: user': $ => $.args({ id: 1 }).select(['name']),
  'secondUser: user': $ => $.args({ id: 2 }).select(['name']),
}])
```

### Inline fragments (union / interface)

Use `'... on TypeName'` as the object key:

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

## Directives

Add directives to fields with `.directives()`. The argument is a tuple of `[directiveName, args?]`:

```ts
$.select([{
  email: $ => $.directives(['@include', { if: vars.showEmail }]),
  title: $ => $.directives(['@deprecated']),
}])
```

Chain multiple directives:

```ts
$.select([{
  field: $ => $
    .directives(['@skip', { if: true }])
    .directives(['@cached', { ttl: 30 }]),
}])
```

> Note: `@skip` and `@include` make the field potentially absent, so the result type becomes nullable.

## Enum values

```ts
const sayingsQuery = gazania.query('GetSayings')
  .select($ => $.select([{
    sayings: $ => $.args({ category: gazania.enum('funny') }).select(['id', 'content']),
  }]))
```

You can also use `.enum()` from the field dollar inside a callback:

```ts
sayings: $ => $.args({ category: $.enum('funny') }).select(['id', 'content'])
```
