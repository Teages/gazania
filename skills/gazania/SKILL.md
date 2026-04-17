---
name: gazania
description: "Gazania — a TypeScript GraphQL query builder. Applies when: writing graphql queries/mutations/subscriptions with gazania."
applyTo: "**/*.ts,**/*.tsx,**/*.vue,**/*.svelte,gazania.config.ts,gazania.config.js"
---

# Gazania Skill

Gazania lets you write GraphQL operations as TypeScript code with full type inference, autocompletion, and compile-time error checking.

## Quick start

### Installation

```sh
pnpm install gazania
npx gazania generate --schema https://api.example.com/graphql --output src/gazania-schema.d.ts
```

### Examples

#### Basic query

```ts
import { createGazania } from 'gazania'

const gazania = createGazania('https://api.example.com/graphql')

const GetHelloQuery = gazania.query('GetHello')
  .select($ => $.select(['hello']))
```

```graphql
query GetHello {
  hello
}
```

#### With variables and arguments

```ts
const FindAdminQuery = gazania.query('FindAdmin')
  .vars({ name: 'String!' })
  .select(($, vars) => $.select([{
    users: $ => $.args({ name: vars.name, first: 1, role: gazania.enum('ADMIN') })
      .select(['id', 'name', 'email']),
  }]))
```

```graphql
query FindAdmin($name: String!) {
  users(name: $name, first: 1, role: ADMIN) {
    id
    name
    email
  }
}
```

### Directives

```ts
const WithDirectiveQuery = gazania.query('WithDirective')
  .vars({ includeEmail: 'Boolean!' })
  .directives(vars => [
    ['@cache', { disable: vars.includeEmail }],
  ])
  .select(($, vars) => $.select([{
    users: $ => $.args({ first: 1 })
      .select([
        'id',
        'name',
        {
          email: $ => $.withDirective(['@include', { if: vars.includeEmail }]),
        }
      ]),
  }]))
```

```graphql
query WithDirective($includeEmail: Boolean!) @cache(disable: $includeEmail) {
  users(first: 1) {
    id
    name
    email @include(if: $includeEmail)
  }
}
```

### Splitting / Reuse Query

```ts
const UserBasicInfo_UserFragment = gazania.partial('UserBasicInfo_User')
  .on('User')
  .select(['id', 'name', 'email'])

const UserBasicInfoQuery = gazania.query('UserBasicInfo')
  .select(($, vars) => $.select([{
    users: $ => $.args({ first: 1 })
      .select([
        ...UserBasicInfo_UserFragment(vars)
      ]),
  }]))
```

```graphql
query UserBasicInfo {
  users(first: 1) {
    ...UserBasicInfo_User
  }
}

fragment UserBasicInfo_User on User {
  id
  name
  email
}
```

## References

Consult these files for detailed patterns before generating code:

- [Setup & configuration](references/setup.md) — install, `gazania.config.ts`, schema generation, multi-schema
- [Building queries](references/building-queries.md) — selections, variables, arguments, aliases, directives, mutations, subscriptions
- [Fragments & partials](references/fragments-and-partials.md) — named fragments, reusable partials, fragment masking
- [Typed documents](references/typed-documents.md) — `ResultOf`, `VariablesOf`, `TypedDocumentNode`, client integration

## Rules

Always follow these rules when writing Gazania code:

- Initialize with `createGazania({} as Schema)` — never pass a real runtime object
- Variable types use GraphQL type strings (e.g. `'Int!'`), not TypeScript types
- Add `!` for non-nullable fields (e.g. `'String!'`), otherwise the result type includes `null | undefined`
- Use `ResultOf` / `VariablesOf` to extract types (e.g. `type User = ResultOf<typeof userQuery>`) — never write them manually
- For fragment masking: type props with `FragmentOf<typeof partial>` and access data via `readFragment()`
- Config file should be named `gazania.config.ts` (Node.js >= 22.6) or `gazania.config.js`
- **NEVER** use external variables or functions inside selection builders, the query **MUST BE** standalone and statically analyzable
