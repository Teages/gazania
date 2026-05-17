import type { DefineSchema, Field, Input, ObjectType, ScalarType } from 'gazania'

type Scalar_Int = ScalarType<'Int', number, number>
type Scalar_Float = ScalarType<'Float', number, number>
type Scalar_String = ScalarType<'String', string, string>
type Scalar_Boolean = ScalarType<'Boolean', boolean, boolean>
type Scalar_ID = ScalarType<'ID', string, string | number>

type Type_Query = ObjectType<'Query', {
  posts: Field<Type_Post[]>
  post: Field<Type_Post | null, {
    id: Input<Scalar_ID>
  }>
}>

type Type_Post = ObjectType<'Post', {
  id: Field<Scalar_ID>
  title: Field<Scalar_String>
  body: Field<Scalar_String>
  author: Field<Type_User>
}>

type Type_User = ObjectType<'User', {
  id: Field<Scalar_ID>
  name: Field<Scalar_String>
  email: Field<Scalar_String>
}>

export type Schema = DefineSchema<{
  Int: Scalar_Int
  Float: Scalar_Float
  String: Scalar_String
  Boolean: Scalar_Boolean
  ID: Scalar_ID
  Query: Type_Query
  Post: Type_Post
  User: Type_User
}, 'sha256:7e7fb6abcc9a9c11e539e685ca95af09cca0b764a4e50c9a0ecedc020115dd56'>
