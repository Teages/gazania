import type { Gazania } from './runtime'
import type { DefineSchema, ReadFragmentFn, TypedGazania } from './types'
import { readFragment as _readFragment, gazania } from './runtime'

export { gazania }
export const readFragment: ReadFragmentFn = _readFragment as ReadFragmentFn

/**
 * Augment this interface to register named schemas for use with `createGazania`.
 *
 * @example
 * ```ts
 * // In the generated schema file:
 * declare module 'gazania' {
 *   interface Schemas {
 *     'https://api.example.com/graphql': Schema
 *   }
 * }
 * ```
 */
export interface Schemas {}

/** @deprecated Unknown schema — register with the CLI or provide a schema type */
export interface UnknownSchema extends Gazania {}

export function createGazania(): UnknownSchema
export function createGazania<T extends DefineSchema<any>>(schema: T): TypedGazania<T>
export function createGazania<T extends keyof Schemas>(url: T): TypedGazania<Schemas[T]>
export function createGazania<T extends string>(url: T): UnknownSchema
export function createGazania<T extends string | DefineSchema<any> = string>(_schemaOrUrl?: T) {
  return gazania as any
}

export type {
  Gazania,
} from './runtime'

export type {
  ResultOfSection,
  TypedGazania,
  VariablesOfSection,
} from './types/builder'

export type {
  BaseObject,
  BaseScalar,
  BaseType,
  DefineSchema,
  EnumType,
  Field,
  Input,
  InputObjectType,
  InterfaceType,
  ObjectType,
  ScalarType,
  UnionType,
} from './types/define'

export type {
  ResultOf,
  TypedDocumentNode,
  VariablesOf,
} from './types/document'

export type {
  FragmentOf,
  FragmentRef,
} from './types/masking'
