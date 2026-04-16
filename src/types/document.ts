import type { DocumentNode } from '../lib/graphql'

export interface TypedDocumentNode<
  Result = Record<string, any>,
  Variables = Record<string, any>,
> extends DocumentNode {
  /** @internal */
  __apiType?: (variables: Variables) => Result
  /** @internal */
  __ensureTypesOfVariablesAndResultMatching?: (variables: Variables) => Result
}

export type ResultOf<T> = T extends TypedDocumentNode<infer Result, any>
  ? Result
  : unknown

export type VariablesOf<T> = T extends TypedDocumentNode<any, infer Variables>
  ? Variables
  : unknown
