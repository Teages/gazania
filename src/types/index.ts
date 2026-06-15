/**
 * Shim barrel: public type exports now live under `src/runtime/`.
 * Kept so existing imports from `src/types` resolve during the merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type { Argument, PrepareSelectionArgument } from '../runtime/argument-types'
export type {
  ReadFragmentFn,
  RequireOperationPartialData,
  ResultOfSection,
  TypedFragmentBuilder,
  TypedGazania,
  TypedOperationBuilderWithoutVars,
  TypedOperationBuilderWithVars,
  TypedPartialBuilder,
  TypedPartialPackage,
  TypedSectionBuilder,
  TypedSectionPackage,
} from '../runtime/builder-types'
export type * from '../runtime/define'
export type { DirectiveInput } from '../runtime/directive-types'
export type { ResultOf, TypedDocumentNode, VariablesOf } from '../runtime/document'
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
} from '../runtime/dollar-types'
export type { EnumFunction, EnumPackage, PackedEnum } from '../runtime/enum'
export type { FragmentOf, FragmentRef, TypedSectionSpreadEntry, TypedSectionSpreadReturn } from '../runtime/masking'
export type { PrepareSelection } from '../runtime/prepare'
export type { ParseSelection } from '../runtime/result'
export type { FindType, ModifiedName, ModifierToType, SchemaRequire, Typename, WrapFieldResult } from '../runtime/utils'
export type { AcceptVariable, AnyVariables, PrepareVariables, RequireVariables, Variable } from '../runtime/variable-types'
