/**
 * Unmask a fragment-masked data object.
 * At runtime this is an identity function: it returns the data as-is.
 * The purpose is type-level: it narrows the opaque `FragmentRef`
 * to the concrete fragment result type.
 *
 * @param _partial - The partial package (used only for type inference).
 * @param data - The fragment-masked data to unmask.
 * @returns The same data, typed as the fragment's result type.
 *
 * @example
 * ```ts
 * const user = readFragment(userPartial, props.user)
 * // user: { id: number, name: string, email: string }
 * ```
 */
export function readFragment(_partial: any, data: any): any {
  return data
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('readFragment', () => {
    it('returns data as-is (identity function)', () => {
      const data = { id: 1, name: 'Alice', email: 'alice@example.com' }
      expect(readFragment(null, data)).toBe(data)
    })

    it('handles null data', () => {
      expect(readFragment(null, null)).toBeNull()
    })

    it('handles undefined data', () => {
      expect(readFragment(null, undefined)).toBeUndefined()
    })

    it('handles array data', () => {
      const arr = [{ id: 1 }, { id: 2 }]
      expect(readFragment(null, arr)).toBe(arr)
    })
  })
}
