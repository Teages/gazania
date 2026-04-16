import { readFileSync } from 'node:fs'
import { defineBuildConfig } from 'unbuild'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index.ts',
    'src/codegen/index.ts',
    'src/cli/index.ts',
  ],
  replace: {
    'import.meta.vitest': 'undefined',
    '__CLI_VERSION__': JSON.stringify(version),
  },
})
