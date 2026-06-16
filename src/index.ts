import type { ReadFragmentFn, TypedGazania } from './runtime/builder-types'
import type { DefineSchema } from './runtime/define'
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

/**
 * Schema-unknown gazania instance.
 *
 * Operations still produce a typed `TypedDocumentNode`, but every selection
 * leaf resolves to `unknown` and every object field recursively preserves its
 * sub-selection shape. Aliases are honored.
 *
 * @example
 * ```ts
 * const g = createGazania()
 * const doc = g.query().select($ => $.select([
 *   'a',
 *   { b: $ => $.select(['c']) },
 * ]))
 * type Result = ResultOf<typeof doc> // { a: unknown, b: { c: unknown } }
 * ```
 */
export type UnknownSchema = import('./runtime/unknown-types').UnknownGazania

export function createGazania(): UnknownSchema
export function createGazania<T extends DefineSchema<any, any>>(schema: T): TypedGazania<T>
export function createGazania<T extends keyof Schemas>(url: T): TypedGazania<Schemas[T]>
export function createGazania<T extends string>(url: T): UnknownSchema
export function createGazania<T extends string | DefineSchema<any, any> = string>(_schemaOrUrl?: T) {
  return gazania as any
}

export type {
  Gazania,
} from './runtime'

export type {
  ObjectSelection,
  PrepareSelection,
  ScalarSelection,
} from './runtime/prepare'

export type {
  ParseObjectSelection,
  ParseObjectSelectionContext,
  ParseObjectSelectionContextField,
  ParseObjectSelectionContextFields,
  ParseSelection,
  ParseSelectionName,
} from './runtime/result'

export type {
  ParseUnknownSelection,
  UnknownFieldCallback,
  UnknownFieldDollar,
  UnknownGazania,
  UnknownOperationBuilderWithoutVars,
  UnknownOperationBuilderWithVars,
  UnknownRootDollar,
  UnknownSelectionItem,
  UnknownSelectionObject,
  UnknownVariables,
} from './runtime/unknown-types'

export type {
  ResultOfSection,
  TypedGazania,
} from './runtime/builder-types'

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
} from './runtime/define'

export type {
  ResultOf,
  TypedDocumentNode,
  VariablesOf,
} from './runtime/document'

export type {
  DollarPayload,
  ObjectFieldDollar,
  ObjectFieldDollarAfterArgs,
  ObjectFieldDollarAfterDirective,
  RootDollar,
  ScalarFieldDollar,
  ScalarFieldDollarAfterArgs,
  TypedScalarSelection,
  TypedSelectionSet,
} from './runtime/dollar-types'

export type {
  FragmentOf,
  FragmentRef,
} from './runtime/masking'
