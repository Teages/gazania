import type { PartialBuilder, PartialPackage } from './partial'
import { createPartialBuilder } from './partial'

export type SectionPackage = PartialPackage
export interface SectionBuilder extends PartialBuilder {}

export function createSectionBuilder(name: string): SectionBuilder {
  return createPartialBuilder(name)
}
