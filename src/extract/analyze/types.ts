import type { Node } from 'estree'
import type { DocumentNode } from '../../lib/graphql'
import type { SelectionInput } from '../../runtime/dollar'

/**
 * Metadata extracted from a gazania builder chain (e.g. `gazania.query(...)`).
 * Represents a single operation, fragment, partial, or section definition
 * found in the source AST before interpretation.
 */
export interface StaticBuilderChain {
  /** The kind of builder chain: query, mutation, subscription, fragment, partial, or section */
  type: 'query' | 'mutation' | 'subscription' | 'fragment' | 'partial' | 'section'
  /** The name of the operation/fragment/partial/section */
  name: string
  /** The type name argument for fragment/partial/section `.on()` calls */
  typeName?: string
  /** Variable definitions from `.vars()` calls, keyed by variable name with type strings */
  variableDefs?: Record<string, string>
  /** Directive definitions attached to this builder chain */
  directives?: StaticDirectiveDef[]
  /** Schema hash from the TypedGazania<Schema> type, used to associate operations with their schema */
  schemaHash?: string
  /** The ESTree AST node of the select callback (FunctionExpression or ArrowFunctionExpression) */
  selectCallback: Node
  /** Parameter names from the callback signature */
  callbackParams: { dollar: string, vars?: string }
  /** Source location offsets */
  loc: { start: number, end: number }
}

/**
 * Output of interpreting a select callback's selection array.
 * Contains the resolved selection items and any partial/section references
 * that need to be resolved separately.
 */
export interface StaticSelectionResult {
  /** The interpreted selection input (array of field names and selection objects) */
  selection: SelectionInput
  /** References to partials/sections used within this selection */
  partialRefs: StaticPartialRef[]
}

/**
 * A reference to a partial or section call within a selection callback.
 * These are resolved separately from the main selection interpretation.
 */
export interface StaticPartialRef {
  /** The fragment name extracted via TypeChecker from the spread callee's type */
  fragmentName: string
  /** The ESTree AST node of the arguments passed to the partial/section call */
  args: Node
  /** Optional ESTree AST node of directives applied to this partial/section call */
  directives?: Node
  /** Source location offsets */
  loc: { start: number, end: number }
}

/**
 * A directive definition extracted from a builder chain's `.directives()` call.
 * Contains the callback function that produces directive values.
 */
export interface StaticDirectiveDef {
  /** The ESTree AST node of the directive callback function */
  callback: Node
  /** Whether the callback accepts a `vars` parameter (receives variable values) */
  hasVarsParam: boolean
}

/**
 * Static definition of a partial or section, extracted from builder chain analysis.
 * Contains all metadata needed to interpret the partial/section's selection callback
 * without runtime evaluation.
 */
export interface StaticPartialDef {
  /** The name of the partial/section */
  name: string
  /** The GraphQL type name this partial/section applies to */
  typeName: string
  /** Variable definitions from `.vars()` calls, keyed by variable name with type strings */
  variableDefs?: Record<string, string>
  /** Directive definitions attached to this partial/section */
  directives?: StaticDirectiveDef[]
  /** The ESTree AST node of the select callback */
  selectCallback: Node
  /** Parameter names from the callback signature */
  callbackParams: { dollar: string, vars?: string }
  /**
   * Snapshot of all other partials that were in scope when this partial was defined
   * (keyed by their local variable name in the source file). Used by buildFragmentDef
   * to resolve transitive partial references across file boundaries.
   */
  scopedDeps?: Map<string, StaticPartialDef>
  /**
   * AST-to-TS-node mapping from the source file where this partial was defined.
   * Used by `buildFragmentDef` to resolve fragment names via the TypeChecker
   * when interpreting this partial's select callback from a different file.
   */
  nodeMap?: WeakMap<any, any>
}

/**
 * Error thrown when a circular fragment reference is detected during static extraction.
 * GraphQL spec Section 5.5.2.2 forbids fragment spreads that form cycles.
 */
export class CircularPartialError extends Error {
  /** The name of the partial that triggered the cycle */
  readonly partialName: string
  /** The full cycle path (e.g. "PartialC → PartialE → PartialC") */
  readonly cyclePath: string

  constructor(partialName: string, cyclePath: string) {
    super(
      `Circular fragment reference detected: ${cyclePath}. `
      + `Fragment spreads must not form cycles (GraphQL spec 5.5.2.2).`,
    )
    this.name = 'CircularPartialError'
    this.partialName = partialName
    this.cyclePath = cyclePath
  }
}

/**
 * Result of extracting all gazania operations from a single source file.
 * Contains the generated GraphQL documents, partial definitions, export mappings,
 * and any skipped calls that could not be statically analyzed.
 */
export interface StaticExtractResult {
  /** The generated GraphQL DocumentNode objects for all operations in the file */
  documents: DocumentNode[]
  /** Map of partial/section names to their static definitions */
  partialDefs: Map<string, StaticPartialDef>
  /** Map of exported names to their local variable bindings */
  exportMap: Map<string, string>
  /** Builder chain calls that were identified but could not be statically interpreted */
  skipped: Array<{ start: number, reason: string }>
}
