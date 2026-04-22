import type { EnumFunction } from '../enum'
import type { FragmentBuilder } from './fragment'
import type { OperationBuilderWithoutVars } from './operation'
import type { PartialBuilder, PartialPackage } from './partial'
import type { SectionBuilder, SectionPackage } from './section'
import { createEnumFunction } from '../enum'
import { createFragmentBuilder } from './fragment'
import { createOperationBuilder } from './operation'
import { createPartialBuilder } from './partial'
import { createSectionBuilder } from './section'

export type { PartialPackage, SectionPackage }

export interface Gazania {
  query: (name?: string) => OperationBuilderWithoutVars
  mutation: (name?: string) => OperationBuilderWithoutVars
  subscription: (name?: string) => OperationBuilderWithoutVars
  fragment: (name: string) => FragmentBuilder
  partial: (name: string) => PartialBuilder
  section: (name: string) => SectionBuilder
  enum: EnumFunction
}

function initGazania(): Gazania {
  const enumFn = createEnumFunction()

  return {
    query: (name?: string) => createOperationBuilder('query', name),
    mutation: (name?: string) => createOperationBuilder('mutation', name),
    subscription: (name?: string) => createOperationBuilder('subscription', name),
    fragment: (name: string) => createFragmentBuilder(name),
    partial: (name: string) => createPartialBuilder(name),
    section: (name: string) => createSectionBuilder(name),
    enum: enumFn,
  }
}

export const gazania = initGazania()

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('Gazania', async () => {
    it('query builder', () => {
      const gazania = initGazania()
      expect(gazania.query).toBeDefined()
      expect(gazania.query).toBeTypeOf('function')
    })

    it('mutation builder', () => {
      const gazania = initGazania()
      expect(gazania.mutation).toBeDefined()
      expect(gazania.mutation).toBeTypeOf('function')
    })

    it('subscription builder', () => {
      const gazania = initGazania()
      expect(gazania.subscription).toBeDefined()
      expect(gazania.subscription).toBeTypeOf('function')
    })

    it('fragment builder', () => {
      const gazania = initGazania()
      expect(gazania.fragment).toBeDefined()
      expect(gazania.fragment).toBeTypeOf('function')
    })

    it('partial builder', () => {
      const gazania = initGazania()
      expect(gazania.partial).toBeDefined()
      expect(gazania.partial).toBeTypeOf('function')
    })

    it('enum function', () => {
      const gazania = initGazania()
      expect(gazania.enum).toBeDefined()
      expect(gazania.enum).toBeTypeOf('function')
    })
  })
}
