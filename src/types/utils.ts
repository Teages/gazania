import type { TypedGazania } from './builder'
import type { BaseObject, BaseScalar, BaseType, DefineSchema, Field, Input, InputObjectType, ScalarType } from './define'
import type { AcceptVariable } from './variable'

// ---------------------------------------------------------------------------
// Internal helpers for structural field-type analysis
// ---------------------------------------------------------------------------

/**
 * Extract the base BaseType from a field/input type (unwrap Array and null).
 * e.g. (Type_User | null)[] | null  →  Type_User
 */
export type BaseOf<T> = NonNullable<T> extends Array<infer U> ? BaseOf<U> : NonNullable<T>

/**
 * Apply the null/array wrapper of FieldType onto result U.
 *
 * Design note: `| null` in the field type represents GraphQL nullability.
 * In TypeScript query results, a nullable GraphQL field maps to `| null | undefined`:
 *   - `null`      = the server explicitly returned null
 *   - `undefined` = the field is absent (partial result / not requested)
 * So `null` in the schema type is automatically expanded to `null | undefined`
 * in the output type, keeping schema definitions clean while output types correct.
 *
 * e.g. WrapFieldResult<(Type_User | null)[] | null, {name: string}>
 *      → ({ name: string } | null | undefined)[] | null | undefined
 */
export type WrapFieldResult<FieldType, U>
  = [FieldType] extends [never]
    ? never
    : null extends FieldType
      ? WrapFieldResult<NonNullable<FieldType>, U> | null | undefined
      : FieldType extends Array<infer Item>
        ? Array<WrapFieldResult<Item, U>>
        : U // base type → substitute with result

/**
 * Convert a TypeScript field type back to a GraphQL modifier string.
 * Used to verify variable compatibility.
 * e.g. Scalar_String[]  →  '[String!]!'
 *      Scalar_String | null  →  'String'
 */
type TypeToModifier<T>
  = [T] extends [never]
    ? never
    : null extends T
      ? _TypeToModifierNullable<NonNullable<T>>
      : _TypeToModifierNonNull<T>

type _TypeToModifierNullable<T>
  = T extends Array<infer U>
    ? `[${TypeToModifier<U>}]`
    : T extends BaseType<any, infer Name>
      ? Name
      : never

type _TypeToModifierNonNull<T>
  = T extends Array<infer U>
    ? `[${TypeToModifier<U>}]!`
    : T extends BaseType<any, infer Name>
      ? `${Name}!`
      : never

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
  = Field<ScalarType<'String', Name, Name>>

export type Typename<T extends BaseType<any, any>>
  = T extends BaseObject<infer Name, any, infer Implements>
    ? Implements extends Record<string, never>
      ? Name
      : keyof Implements
    : never

/**
 * Extract the base type name from a GraphQL modifier string.
 * Still needed by the variable declaration system (.vars({ a: 'String!' })).
 * e.g. '[String!]!' → 'String'
 */
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

/**
 * Convert a GraphQL modifier string + schema into a native TypeScript type.
 * Used by the variable declaration system to convert '.vars({ a: "Int!" })'
 * into a concrete TypeScript type.
 * e.g. 'Int!'         → Scalar_Int
 *      'Int'          → Scalar_Int | null
 *      '[Int!]!'      → Scalar_Int[]
 *      '[Int]!'       → (Scalar_Int | null)[]
 *      '[Int!]'       → Scalar_Int[] | null
 *      '[Int]'        → (Scalar_Int | null)[] | null
 */
export type ModifierToType<Schema, Modifier extends string>
  = _ModifierToTypeHelper<Schema, Modifier, false>

type _ModifierToTypeHelper<Schema, Modifier extends string, NonNull extends boolean>
  = Modifier extends `${string}!!`
    ? never
    : Modifier extends `${infer F}!`
      ? _ModifierToTypeHelper<Schema, F, true>
      : Modifier extends `[${infer F}]`
        ? _ListModifierToType<Schema, F, NonNull>
        : _BaseModifierToType<Schema, Modifier, NonNull>

type _ListModifierToType<Schema, ItemModifier extends string, NonNull extends boolean>
  = _ModifierToTypeHelper<Schema, ItemModifier, false> extends never
    ? never
    : NonNull extends true
      ? Array<_ModifierToTypeHelper<Schema, ItemModifier, false>>
      : Array<_ModifierToTypeHelper<Schema, ItemModifier, false>> | null

type _BaseModifierToType<Schema, Name extends string, NonNull extends boolean>
  = FindType<Schema, Name> extends never
    ? never
    : NonNull extends true
      ? FindType<Schema, Name>
      : FindType<Schema, Name> | null

// Unwrap EnumPackage<T> → T for use in variable types (plain strings, not builders)
type UnpackEnumInput<T> = T extends (() => infer U extends string) ? U : T

/**
 * Compute the required TypeScript type for a field Input<T>.
 * Handles null propagation, array coercion (single item accepted for lists),
 * and enum unpacking.
 */
export type RequireInput<T extends Input<any>>
  = T extends Input<infer FieldType>
    ? _RequireInputFromType<FieldType>
    : never

type _RequireInputFromType<T>
  = null extends T
    ? _RequireInputFromType<NonNullable<T>> | null | undefined
    : T extends Array<infer Item>
      ? _RequireInputFromType<Item> extends never
        ? never
        : Array<_RequireInputFromType<Item>> | _RequireInputBaseValue<NonNullable<Item>>
      : _RequireInputBaseValue<T>

// Resolve the scalar/input-object direct value (no array, no null wrapper)
type _RequireInputBaseValue<T>
  = T extends BaseScalar<any, any, infer InputType>
    ? UnpackEnumInput<InputType>
    : T extends InputObjectType<any, infer Fields>
      ? RelaxedOptional<{ [K in keyof Fields]: RequireInput<Fields[K]> }>
      : never

export type RequireInputOrVariable<T extends Input<any>>
  = T extends Input<infer FieldType>
    ? _RequireInputOrVariableFromType<FieldType> | AcceptVariable<TypeToModifier<FieldType>>
    : never

// Separate recursion path for RequireInputOrVariable:
// - Keeps packed enum types (functions) instead of unpacking to plain strings
// - Nested InputObject fields also use RequireInputOrVariable (adds AcceptVariable at each level)
type _RequireInputOrVariableFromType<T>
  = null extends T
    ? _RequireInputOrVariableFromType<NonNullable<T>> | null | undefined
    : T extends Array<infer Item>
      ? _RequireInputOrVariableFromType<Item> extends never
        ? never
        : Array<_RequireInputOrVariableFromType<Item>> | _RequireInputOrVariableBaseValue<NonNullable<Item>>
      : _RequireInputOrVariableBaseValue<T>

type _RequireInputOrVariableBaseValue<T>
  = T extends BaseScalar<any, any, infer InputType>
    ? InputType // keep packed enums as-is (callers can pass factory functions or variables)
    : T extends InputObjectType<any, infer Fields>
      ? RelaxedOptional<{ [K in keyof Fields]: RequireInputOrVariable<Fields[K]> }>
      : never

export type SchemaRequire<Gazania extends TypedGazania<any>, Modifier extends string>
  = Gazania extends TypedGazania<infer Schema>
    ? RequireInput<Input<ModifierToType<Schema, Modifier>>>
    : never
