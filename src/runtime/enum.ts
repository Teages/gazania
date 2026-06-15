export interface EnumPackage<T extends string> {
  (): T
}

// PackedEnum distributes EnumPackage over a union of enum value literals.
// Merged from src/types/enum.ts (was the only types-only member of the enum module).
export type PackedEnum<T extends string>
  = T extends any ? EnumPackage<T> : never

export interface EnumFunction {
  <T extends string>(value: T): EnumPackage<T>
}

export function createEnumFunction(): EnumFunction {
  return <T extends string>(value: T): EnumPackage<T> => () => value
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('enum', () => {
    it('creates an enum package that returns the value', () => {
      const enumFn = createEnumFunction()
      const pkg = enumFn('ANIME')
      expect(pkg()).toBe('ANIME')
    })

    it('preserves different enum values', () => {
      const enumFn = createEnumFunction()
      expect(enumFn('MANGA')()).toBe('MANGA')
      expect(enumFn('NOVEL')()).toBe('NOVEL')
    })
  })
}
