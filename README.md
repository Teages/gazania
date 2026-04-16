# Gazania

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]

<!-- [![bundle][bundle-src]][bundle-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

Gazania provides a *typed* way to write GraphQL queries with the help of TypeScript.

## Usage

Install package:

```sh
# npm
npm install gazania

# yarn
yarn add gazania

# pnpm
pnpm install gazania

# bun
bun install gazania
```

Import:

```js
// ESM
import { createGazania } from 'gazania'
```

```js
// CommonJS
const { createGazania } = require('gazania')
```

## Development

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

## License

Published under [MIT License](./LICENSE).

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/gazania?style=flat&color=blue
[npm-version-href]: https://npmjs.com/package/gazania
[npm-downloads-src]: https://img.shields.io/npm/dm/gazania?style=flat&color=blue
[npm-downloads-href]: https://npmjs.com/package/gazania

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/Teages/gazania/main?style=flat&color=blue
[codecov-href]: https://codecov.io/gh/Teages/gazania

[bundle-src]: https://img.shields.io/bundlephobia/minzip/gazania?style=flat&color=blue
[bundle-href]: https://bundlephobia.com/result?p=gazania -->
