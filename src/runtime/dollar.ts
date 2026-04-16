import type { ArgumentMap } from './argument'
import type { DirectiveInput } from './directive'
import type { EnumFunction } from './enum'
import { createEnumFunction } from './enum'
import { DollarPackageSymbol } from './symbol'

/**
 * Return value container from field callbacks.
 * Holds accumulated state: args, selection, and directives.
 *
 * Both scalar and object field dollars share this implementation at runtime.
 * Type-level distinction is handled by the type system.
 */
export class FieldDollar {
  [DollarPackageSymbol] = true

  _args: ArgumentMap | undefined
  _selection: SelectionInput | undefined
  _directives: DirectiveInput[] | undefined

  readonly enum: EnumFunction

  constructor(enumFn?: EnumFunction) {
    this.enum = enumFn ?? createEnumFunction()
  }

  args(a: ArgumentMap): FieldDollar {
    this._args = a
    return this
  }

  select<const T extends SelectionInput>(sel: [...T]): FieldDollar {
    this._selection = sel
    return this
  }

  withDirective(...directives: DirectiveInput[]): FieldDollar {
    this._directives = this._directives || []
    this._directives.push(...directives)
    return this
  }
}

export type SelectionInput = Array<string | SelectionObject>

export interface SelectionObject {
  [key: string]: true | ((dollar: FieldDollar) => FieldDollar)
}

export type SelectionValue
  = | true // scalar shorthand (no args)
    | ((dollar: FieldDollar) => FieldDollar) // callback for field with args/selection/directives

export interface PartialResultValue {
  _fragmentName: string
  _documentNode: unknown // DocumentNode, kept as unknown to avoid circular import
  _directives?: DirectiveInput[]
}

export function isDollarPackage(value: unknown): value is FieldDollar {
  return value != null && typeof value === 'object' && DollarPackageSymbol in value
}

export function createFieldDollar(enumFn?: EnumFunction): FieldDollar {
  return new FieldDollar(enumFn)
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('dollar', () => {
    it('creates FieldDollar with DollarPackageSymbol', () => {
      const d = createFieldDollar()
      expect(isDollarPackage(d)).toBe(true)
    })

    it('isDollarPackage returns false for non-dollar', () => {
      expect(isDollarPackage(null)).toBe(false)
      expect(isDollarPackage({})).toBe(false)
      expect(isDollarPackage('string')).toBe(false)
    })

    it('args sets _args and returns self', () => {
      const d = createFieldDollar()
      const result = d.args({ id: 1 })
      expect(result).toBe(d)
      expect(d._args).toEqual({ id: 1 })
    })

    it('select sets _selection and returns self', () => {
      const d = createFieldDollar()
      const result = d.select(['id', 'name'])
      expect(result).toBe(d)
      expect(d._selection).toEqual(['id', 'name'])
    })

    it('withDirective appends directives', () => {
      const d = createFieldDollar()
      d.withDirective(['@skip', { if: true }])
      d.withDirective(['@include', { if: false }])
      expect(d._directives).toHaveLength(2)
    })

    it('enum creates enum packages', () => {
      const d = createFieldDollar()
      const pkg = d.enum('ANIME')
      expect(pkg()).toBe('ANIME')
    })
  })
}
