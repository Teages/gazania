export interface EnumPackage<T extends string> {
  (): T
}

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
