import { defineConfig } from 'gazania/config'

export default defineConfig({
  schemas: [
    {
      output: 'gazania/anilist.ts',
      schema: 'https://graphql.anilist.co',
    },
  ],
})
