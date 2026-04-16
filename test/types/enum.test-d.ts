import type { EnumFunction, EnumPackage, PackedEnum } from '../../src/types/enum'
import { describe, expectTypeOf, test } from 'vitest'

describe('types/enum', () => {
  test('EnumPackage', () => {
    // EnumPackage is a callable that returns the enum string
    type Pkg = EnumPackage<'ANIME'>
    expectTypeOf<Pkg>().toBeCallableWith()
    expectTypeOf<ReturnType<Pkg>>().toEqualTypeOf<'ANIME'>()
  })

  test('PackedEnum', () => {
    // PackedEnum distributes over union
    type Packed = PackedEnum<'ANIME' | 'MANGA'>
    expectTypeOf<Packed>().toEqualTypeOf<EnumPackage<'ANIME'> | EnumPackage<'MANGA'>>()
  })

  test('EnumFunction', () => {
    // EnumFunction takes a string and returns an EnumPackage
    const fn: EnumFunction = null as any
    const result = fn('ANIME')
    expectTypeOf(result).toEqualTypeOf<EnumPackage<'ANIME'>>()
  })
})
