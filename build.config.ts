import type { BuildConfig } from 'obuild/config'
import { defineBuildConfig } from 'obuild/config'
import { version } from './package.json' with { type: 'json' }

type RolldownConfig = (Exclude<NonNullable<BuildConfig['entries']>[number], string> & { type: 'bundle' })['rolldown']

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
        'src/extract/index.ts',
      ],
      dts: {
        build: true,
      },
      rolldown: rolldownConfig,
    },
  ],
})
