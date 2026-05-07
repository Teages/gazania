import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/.git/**', '.reference/**'],
    includeSource: ['src/**/*.ts'],
    typecheck: {
      enabled: true,
      tsconfig: 'tsconfig.json',
    },
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/types/**/*.ts'],
    },
  },
})
