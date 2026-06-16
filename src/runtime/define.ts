import type { PackedEnum } from './enum'

// These are the phantom type constructors
// instantiated by generated schema files (via the `gazania` root export).
// Pure type-level; no runtime values.

export interface BaseType<Base extends string, Name extends string> {
  readonly ' $baseType'?: () => Base
  readonly ' $baseName'?: () => Name
}

export interface BaseScalar<
  Name extends string,
  Output,
  Input,
> extends BaseType<'BaseScalar', Name> {
  readonly ' $scalarDefine'?: (input: Input) => Output
}

export interface BaseObject<
  Name extends string,
  Fields extends Record<string, Field<any, any>>,
  Implements extends Record<string, BaseObject<string, any, any>>,
> extends BaseType<'BaseObject', Name> {
  readonly ' $objectDefine'?: (Implements: Implements) => Fields
}

export interface DefineSchema<
  Namespace extends Record<string, BaseType<any, any>>,
  SchemaHash extends string = string,
> {
  readonly ' $schemaDefine'?: () => Namespace
  readonly ' $schemaHash'?: SchemaHash
}

export interface Input<
  T,
> {
  readonly ' $inputDefine'?: () => T
}

export interface Field<
  T,
  Args extends Record<string, Input<any>> = Record<string, never>,
> {
  readonly ' $fieldDefine'?: (args: Args) => T
}

export interface ScalarType<
  Name extends string,
  Output,
  Input,
> extends BaseScalar<Name, Output, Input> {
  readonly ' $typeKind'?: () => 'Scalar'
}

export interface EnumType<
  Name extends string,
  Definition extends string,
> extends BaseScalar<Name, Definition, PackedEnum<Definition>> {
  readonly ' $typeKind'?: () => 'Enum'
}

export interface ObjectType<
  Name extends string,
  Fields extends Record<string, Field<any, any>>,
> extends BaseObject<Name, Fields, Record<string, never>> {
  readonly ' $typeKind'?: () => 'Type'
}

export interface UnionType<
  Name extends string,
  Implements extends Record<string, BaseObject<any, any, any>>,
> extends BaseObject<Name, Record<string, never>, Implements> {
  readonly ' $typeKind'?: () => 'Union'
}

export interface InterfaceType<
  Name extends string,
  Fields extends Record<string, Field<any, any>>,
  Implements extends Record<string, BaseObject<string, any, any>>,
> extends BaseObject<Name, Fields, Implements> {
  readonly ' $typeKind'?: () => 'Interface'
}

export interface InputObjectType<
  Name extends string,
  Fields extends Record<string, Input<any>>,
> extends BaseType<'InputObject', Name> {
  readonly ' $inputObjectDefine'?: (fields: Fields) => void
}
