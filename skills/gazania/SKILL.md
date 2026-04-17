---
name: gazania
description: "Set up and use Gazania — a TypeScript GraphQL query builder. Applies when: generating schema types, writing type-safe queries/mutations/subscriptions, using fragments and partials to reuse selection sets, extracting result and variable types."
applyTo: "**/*.ts,**/*.tsx,**/*.vue,**/*.svelte,gazania.config.ts,gazania.config.js"
---

# Gazania Skill

Gazania lets you write GraphQL operations as TypeScript code with full type inference, autocompletion, and compile-time error checking.

## Quick-start

```sh
pnpm install gazania
npx gazania generate --schema https://api.example.com/graphql --output src/schema.ts
```

```ts
import type { Schema } from './schema'
import { createGazania } from 'gazania'

const gazania = createGazania({} as Schema)

const userQuery = gazania.query('GetUser')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select(['id', 'name', 'email']),
  }]))
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
