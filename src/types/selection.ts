declare const TypedSelectionSetContentSymbol: unique symbol
declare const TypedSelectionSetIsOptionalSymbol: unique symbol

/**
 * Terminal type for object field callbacks, returned by `.select()`.
 * Extends the GraphQL AST SelectionSet concept with phantom types
 * for the selection content and the optional flag.
 */
export interface TypedSelectionSet<T = unknown, IsOptional extends boolean = false> {
  [TypedSelectionSetContentSymbol]?: () => T
  [TypedSelectionSetIsOptionalSymbol]?: () => IsOptional
}

declare const TypedScalarSelectionIsOptionalSymbol: unique symbol

/**
 * Terminal type for scalar field callbacks.
 * Scalars have no SelectionSet in GraphQL, so this is a separate phantom type.
 */
export interface TypedScalarSelection<IsOptional extends boolean = false> {
  [TypedScalarSelectionIsOptionalSymbol]?: () => IsOptional
}
