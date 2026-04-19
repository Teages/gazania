import { defineConfig } from 'gazania/codegen'

export default defineConfig({
  schema: 'https://graphql-test.teages.xyz/graphql-user-apq',
  output: 'src/schema.ts',
})
