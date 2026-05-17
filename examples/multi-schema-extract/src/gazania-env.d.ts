import type { Schema as BlogSchema } from '../generated/blog'
import type { Schema as ShopSchema } from '../generated/shop'

declare module 'gazania' {
  interface Schemas {
    blog: BlogSchema
    shop: ShopSchema
  }
}
