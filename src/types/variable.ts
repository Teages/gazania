/**
 * Shim: variable type-level machinery now lives in
 * `src/runtime/variable-types.ts`. Kept separate from
 * `src/runtime/variable.ts` (the runtime `Variable` class) because the phantom
 * `interface Variable<T>` would declaration-merge with the class if colocated.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
export type {
  AcceptVariable,
  AnyVariables,
  PrepareVariables,
  RequireVariables,
  Variable,
  VariableDefResult,
  VariablesDefinition,
  VariablesDefinitionDollar,
  VariablesDefinitionDollarPackage,
} from '../runtime/variable-types'
