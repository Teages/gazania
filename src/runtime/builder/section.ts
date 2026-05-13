import type { PartialBuilder, PartialPackage } from './partial'
import { createPartialBuilder } from './partial'

export type SectionPackage<Name extends string = string> = PartialPackage<Name>
export interface SectionBuilder<Name extends string = string> extends PartialBuilder<Name> {}

export function createSectionBuilder<const Name extends string>(name: Name): SectionBuilder<Name> {
  return createPartialBuilder(name)
}
