import type { TypedGazania } from './builder'
import type { BaseObject, BaseScalar, BaseType, DefineSchema, Field, Input, InputObjectType, ScalarType } from './define'
import type { AcceptVariable } from './variable'

/**
 * Flatten an intersection of record types into a single record.
 */
export type FlatRecord<T> = T extends { [key: string]: unknown }
  ? { [K in keyof T]: FlatRecord<T[K]> }
  : T

/**
 * Make all properties whose type includes `undefined` optional.
 */
export type RelaxedOptional<T> = FlatRecord<{
  [K in keyof T as undefined extends T[K] ? never : K]: T[K]
} & {
  [K in keyof T as undefined extends T[K] ? K : never]?: T[K]
}>

/**
 * Get the value types of a record.
 */
export type Values<T> = T[keyof T]

/**
 * Exact-match helper to prevent excess properties.
 * @see https://github.com/microsoft/TypeScript/issues/12936#issuecomment-2088768988
 */
export type Exact<Shape, T extends Shape>
  = Shape extends (...args: any) => any
    ? ExactFunction<Shape, T>
    : Shape extends [...infer ItemShapes extends Array<string>, infer FollowShape extends Record<string, any>]
      ? T extends Array<string>
        ? T[number] extends ItemShapes[number]
          ? T
          : never
        : T extends [...infer Items extends ItemShapes, infer Follow extends FollowShape]
          ? [...Items, ExactRecord<FollowShape, Follow>]
          : never
      : Shape extends Record<string, any>
        ? ExactRecord<Shape, T>
        : T
type ExactFunction<Shape extends (...args: any) => any, T extends Shape>
  = Shape extends (...args: any) => infer RetShape
    ? T extends (...args: infer Args) => (infer Ret extends RetShape)
      ? (...args: Args) => Exact<RetShape, Ret>
      : never
    : never
type ExactRecord<Shape extends Record<string, any>, T extends Shape> = {
  [Key in keyof T]: Key extends keyof Shape
    ? Exact<Shape[Key], T[Key]>
    : never
}

/**
 * Convert a union to an intersection.
 */
export type UnionToIntersection<U extends Record<string, any>>
  = (U extends any ? (x: U) => void : never) extends ((x: infer I) => void) ? I : never

export type DefaultSpaces = ' ' | '\t' | '\n' | '\r'

export type TrimBefore<T, S extends string = DefaultSpaces>
  = T extends `${S}${infer Rest}` ? TrimBefore<Rest, S> : T

export type TrimAfter<T, S extends string = DefaultSpaces>
  = T extends `${infer Rest}${S}` ? TrimAfter<Rest, S> : T

export type Trim<T, S extends string = DefaultSpaces>
  = TrimBefore<TrimAfter<T, S>, S>

/**
 * Recursively expand an object type for readable hover info.
 */
export type Expand<T> = T extends (...args: infer A) => infer R
  ? (...args: Expand<A>) => Expand<R>
  : T extends object
    ? T extends infer O
      ? { [K in keyof O]: Expand<O[K]> }
      : never
    : T

export type MayBePartial<T> = { [K in keyof T]: T[K] | null | undefined }

export type IntersectionAvoidEmpty<T, U>
  = T extends Record<string, never>
    ? U
    : U extends Record<string, never>
      ? T
      : T & U


export type TypenameField<Name extends string>
  = Field<'String!', ScalarType<'String', Name, Name>>

export type Typename<T extends BaseType<any, any>>
  = T extends BaseObject<infer Name, any, infer Implements>
    ? Implements extends Record<string, never>
      ? Name
      : keyof Implements
    : never

export type ModifiedName<Modifier extends string>
  = Modifier extends `${string}!!`
    ? never
    : Modifier extends `${infer F}!`
      ? ModifiedName<F>
      : Modifier extends `[${infer F}]`
        ? ModifiedName<F>
        : Modifier

export type FindType<Schema, Name extends string>
  = Schema extends DefineSchema<infer Namespace>
    ? Name extends keyof Namespace
      ? Namespace[Name]
      : never
    : never

export type RequireInput<T extends Input<any, any>>
  = T extends Input<infer Modifier, infer Type>
    ? Type extends BaseScalar<any, any, infer InputType>
      ? ParseInputModifier<Modifier, Type, InputType>
      : Type extends InputObjectType<any, infer Fields>
        ? ParseInputModifier<Modifier, Type, { [K in keyof Fields]: RequireInput<Fields[K]> }>
        : never
    : never

export type RequireInputOrVariable<T extends Input<any, any>>
  = T extends Input<infer Modifier, infer Type>
    ? Type extends BaseScalar<any, any, infer InputType>
      ? ParseInputModifier<Modifier, Type, InputType> | AcceptVariable<Modifier>
      : Type extends InputObjectType<any, infer Fields>
        ? ParseInputModifier<Modifier, Type, { [K in keyof Fields]: RequireInputOrVariable<Fields[K]> }> | AcceptVariable<Modifier>
        : never
    : never

export type ParseOutputModifier<
  Modifier extends string,
  T extends BaseType<any, any>,
  U,
>
  = Modifier extends `${string}!!`
    ? never
    : Modifier extends `${infer F}!`
      ? ParseOutputModifier<F, T, U> & {}
      : Modifier extends `[${infer F}]`
        ? ParseOutputModifier<F, T, U> extends never
          ? never
          : Array<ParseOutputModifier<F, T, U>> | null | undefined
        : T extends BaseType<any, Modifier>
          ? U | null | undefined
          : never

export type ParseInputModifier<
  Modifier extends string,
  T extends BaseType<any, any>,
  U,
> = RelaxInputArray<_ParseInputModifier<Modifier, T, U>, U>

type _ParseInputModifier<
  Modifier extends string,
  T extends BaseType<any, any>,
  U,
>
  = Modifier extends `${string}!!`
    ? never
    : Modifier extends `${infer F}!`
      ? _ParseInputModifier<F, T, U> & {}
      : Modifier extends `[${infer F}]`
        ? _ParseInputModifier<F, T, U> extends never
          ? never
          : Array<_ParseInputModifier<F, T, U>> | null | undefined
        : T extends BaseType<any, Modifier>
          ? U | null | undefined
          : never

type RelaxInputArray<T, U>
  = [T] extends [never]
    ? never
    : T extends Array<any>
      ? T | U
      : T


export type SchemaRequire<Gazania extends TypedGazania<any>, Modifier extends string>
  = Gazania extends TypedGazania<infer Schema>
    ? RequireInput<Input<Modifier, FindType<Schema, ModifiedName<Modifier>>>>
    : never
