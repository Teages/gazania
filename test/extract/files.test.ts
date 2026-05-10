import { describe, expect, it } from 'vitest'
import { offsetToLineColumn } from '../../src/extract/files'

describe('offsetToLineColumn', () => {
  it('returns line 2, column 1 for offset after newline', () => {
    expect(offsetToLineColumn('hello\nworld', 6)).toEqual({ line: 2, column: 1, offset: 6 })
  })

  it('returns line 1, column 1 for offset 0', () => {
    expect(offsetToLineColumn('abc', 0)).toEqual({ line: 1, column: 1, offset: 0 })
  })

  it('returns line 1, column 4 for end of string', () => {
    expect(offsetToLineColumn('abc', 3)).toEqual({ line: 1, column: 4, offset: 3 })
  })

  it('handles multiple newlines', () => {
    expect(offsetToLineColumn('a\nb\nc', 2)).toEqual({ line: 2, column: 1, offset: 2 })
  })
})
