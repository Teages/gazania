import type { TypedSectionBuilder } from '../builder-types'
import type { DefineSchema } from '../define'
import type { PartialBuilder, PartialPackage } from './partial'
import { createPartialBuilder } from './partial'

export type SectionPackage<Name extends string = string> = PartialPackage<Name>
export interface SectionBuilder<Name extends string = string> extends PartialBuilder<Name> {}

export function createSectionBuilder<const Name extends string>(name: Name): SectionBuilder<Name>
export function createSectionBuilder<
  Schema extends DefineSchema<any, any>,
  const Name extends string = string,
>(name: Name): TypedSectionBuilder<Schema, Name>
export function createSectionBuilder<const Name extends string>(
  name: Name,
): SectionBuilder<Name> | TypedSectionBuilder<any, Name> {
  return createPartialBuilder(name)
}
