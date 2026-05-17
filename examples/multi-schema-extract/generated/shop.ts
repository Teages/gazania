/* eslint-disable */
import type { DefineSchema, Field, Input, ObjectType, ScalarType } from 'gazania'

type Scalar_Int = ScalarType<'Int', number, number>
type Scalar_Float = ScalarType<'Float', number, number>
type Scalar_String = ScalarType<'String', string, string>
type Scalar_Boolean = ScalarType<'Boolean', boolean, boolean>
type Scalar_ID = ScalarType<'ID', string, string | number>

type Type_Query = ObjectType<'Query', {
  products: Field<Type_Product[]>
  product: Field<Type_Product | null, {
    id: Input<Scalar_ID>
  }>
}>

type Type_Product = ObjectType<'Product', {
  id: Field<Scalar_ID>
  name: Field<Scalar_String>
  price: Field<Scalar_Float>
  inStock: Field<Scalar_Boolean>
}>

export type Schema = DefineSchema<{
  Int: Scalar_Int
  Float: Scalar_Float
  String: Scalar_String
  Boolean: Scalar_Boolean
  ID: Scalar_ID
  Query: Type_Query
  Product: Type_Product
}, 'sha256:465810c3790c3f6af014b3392081f182b52a462617f78ce3af1ac6d2998b8c6f'>
