/**
 * Shim: phantom schema type constructors now live in `src/runtime/define.ts`.
 * Kept as a re-export so existing imports from `src/types/define` (including
 * the generated schema files via the `gazania` root export) continue to
 * resolve during the incremental merge.
 *
 * @see .sisyphus/notepads/merge-types-into-runtime/research.md
 */
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
} from '../runtime/define'
