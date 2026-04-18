import type { BuildConfig } from 'obuild/config'
import { readFileSync } from 'node:fs'
import { defineBuildConfig } from 'obuild/config'

type RolldownConfig = (Exclude<NonNullable<BuildConfig['entries']>[number], string> & { type: 'bundle' })['rolldown']

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

const rolldownConfig = {
  transform: {
    define: {
      'import.meta.vitest': 'undefined',
      '__CLI_VERSION__': JSON.stringify(version),
    },
  },
} satisfies RolldownConfig

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: [
        'src/index.ts',
        'src/codegen/index.ts',
        'src/cli/index.ts',
        'src/transform/index.ts',
      ],
      dts: {
        build: true,
      },
      rolldown: rolldownConfig,
    },
  ],
})
