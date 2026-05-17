import { createGazania } from 'gazania'

// Uses the 'shop' schema registered via module augmentation in gazania-env.d.ts
export const shop = createGazania('shop')

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
