import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Gazania',
  description: 'Typed GraphQL Queries with TypeScript',

  cleanUrls: true,

  markdown: {
    codeTransformers: [
      transformerTwoslash(),
    ],
  },

  themeConfig: {
    nav: [
      { text: 'Documentation', link: '/get-started/introduction' },
      { text: 'Reference', link: '/reference/api' },
    ],

    sidebar: {
      '/': [
        {
          text: 'Get Started',
          collapsed: false,
          items: [
            { text: 'Introduction', link: '/get-started/introduction' },
            { text: 'Installation', link: '/get-started/installation' },
            { text: 'Writing Queries', link: '/get-started/writing-queries' },
            { text: 'Workflows', link: '/get-started/workflows' },
          ],
        },
        {
          text: 'Guides',
          collapsed: false,
          items: [
            { text: 'Typed Documents', link: '/guides/typed-documents' },
            { text: 'Selections', link: '/guides/selections' },
            { text: 'Fragments & Partials', link: '/guides/fragments-and-partials' },
            { text: 'Multiple Schemas', link: '/guides/multiple-schemas' },
            { text: 'Build Transform Plugin', link: '/guides/transform-plugin' },
            { text: 'Persisted Queries', link: '/guides/persisted-queries' },
          ],
        },
        {
          text: 'Reference',
          collapsed: false,
          items: [
            { text: 'Gazania API', link: '/reference/api' },
            { text: 'Gazania CLI', link: '/reference/cli' },
            { text: 'Config Format', link: '/reference/config-format' },
            { text: 'Transform Plugin API', link: '/reference/transform-api' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Teages/gazania' },
    ],

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/Teages/gazania/edit/main/docs/:path',
    },

    outline: { level: [2, 3] },
  },
})
