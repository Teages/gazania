import { createGazania } from 'gazania'

// Both schemas are registered via module augmentation in gazania-env.d.ts.
// The generated types include a schema source hash that gazania extract uses
// to automatically match each query to the correct schema for validation.
export const blog = createGazania('blog')
export const shop = createGazania('shop')

// --- Blog queries (validated against schemas/blog.graphql) ---

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

// --- Shop queries (validated against schemas/shop.graphql) ---

export const allProducts = shop.query('AllProducts')
  .select($ => $.select([{
    products: $ => $.select([
      'id',
      'name',
      'price',
    ]),
  }]))

export const productById = shop.query('ProductById')
  .vars({ id: 'ID!' })
  .select(($, vars) => $.select([{
    product: $ => $.args({ id: vars.id })
      .select([
        'id',
        'name',
        'price',
        'inStock',
      ]),
  }]))
