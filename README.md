# Gazania

Gazania lets you write GraphQL operations as TypeScript code with full type inference, autocompletion, and compile-time error checking.

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]

## Quick Start

Install:

```sh
pnpm add gazania
```

Generate types from your schema, then build typed queries:

```ts
import type { ResultOf } from 'gazania'
import type { Schema } from './generated-schema'
import { createGazania } from 'gazania'

const gazania = createGazania({} as Schema)

const userQuery = gazania.query('GetUser')
  .vars({ id: 'Int!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select([
      'id',
      'name',
      'email',
    ]),
  }]))

type Result = ResultOf<typeof userQuery>
// { user: { id: number, name: string, email: string } }
```

📖 **Full documentation**: [gazania.teages.dev](https://gazania.teages.dev/)

## License

Published under [MIT License](./LICENSE).

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/gazania?style=flat&color=blue
[npm-version-href]: https://npmjs.com/package/gazania
[npm-downloads-src]: https://img.shields.io/npm/dm/gazania?style=flat&color=blue
[npm-downloads-href]: https://npmjs.com/package/gazania
