import { defineConfig } from 'gazania/config'

export default defineConfig({
  schemas: [
    {
      schema: './schemas/blog.graphql',
      output: 'generated/blog.ts',
    },
    {
      schema: './schemas/shop.graphql',
      output: 'generated/shop.ts',
    },
  ],
  extract: {
    dir: 'src',
    output: 'manifest.json',
    validate: true,
  },
})
