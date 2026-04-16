import { defineConfig } from 'gazania/codegen'

export default defineConfig({
  output: 'gazania/anilist.ts',
  schema: 'https://graphql.anilist.co',
})
