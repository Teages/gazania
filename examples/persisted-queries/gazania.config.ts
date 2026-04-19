import { defineConfig } from 'gazania/codegen'

export default defineConfig({
  schema: 'https://nitro-graphql-tester.pages.dev/graphql-user',
  output: 'src/schema.ts',
})
