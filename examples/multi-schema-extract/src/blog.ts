import { createGazania } from 'gazania'

// Uses the 'blog' schema registered via module augmentation in gazania-env.d.ts
// The generated types include a schema source hash that gazania extract uses
// to automatically match queries to the correct schema for validation.
export const blog = createGazania('blog')

export const allPosts = blog.query('AllPosts')
  .select($ => $.select([{
    posts: $ => $.select([
      'id',
      'title',
      {
        author: $ => $.select([
          'name',
        ]),
      },
    ]),
  }]))

export const postById = blog.query('PostById')
  .vars({ id: 'ID!' })
  .select(($, vars) => $.select([{
    post: $ => $.args({ id: vars.id })
      .select([
        'id',
        'title',
        'body',
        {
          author: $ => $.select([
            'name',
            'email',
          ]),
        },
      ]),
  }]))
