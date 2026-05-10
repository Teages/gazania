import type { ExtractManifest } from '../../src/extract/manifest'
import { createHash } from 'node:crypto'
import { parse } from 'graphql'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDocumentToManifest } from '../../src/extract/manifest'

const sha256 = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`

function makeLoc(line: number, column: number) {
  return {
    start: { line, column, offset: 0 },
    end: { line, column: column + 10, offset: 100 },
  }
}

describe('addDocumentToManifest duplicate detection', () => {
  let manifest: ExtractManifest

  beforeEach(() => {
    manifest = { operations: {}, fragments: {} }
  })

  it('throws on duplicate operation name with different body', () => {
    const doc1 = parse('query GetUser { user { id } }')
    const doc2 = parse('query GetUser { user { name } }')

    addDocumentToManifest(manifest, doc1, sha256, makeLoc(1, 1))

    expect(() => addDocumentToManifest(manifest, doc2, sha256, makeLoc(5, 1)))
      .toThrow('Duplicate operation name "GetUser"')
  })

  it('silently skips duplicate operation name with same body', () => {
    const doc = parse('query GetUser { user { id } }')

    addDocumentToManifest(manifest, doc, sha256, makeLoc(1, 1))
    addDocumentToManifest(manifest, doc, sha256, makeLoc(10, 1))

    expect(Object.keys(manifest.operations)).toHaveLength(1)
    expect(manifest.operations.GetUser!.loc.start.line).toBe(1)
  })

  it('throws on duplicate fragment name with different body', () => {
    const doc1 = parse('fragment UserFields on User { id }')
    const doc2 = parse('fragment UserFields on User { name }')

    addDocumentToManifest(manifest, doc1, sha256, makeLoc(1, 1))

    expect(() => addDocumentToManifest(manifest, doc2, sha256, makeLoc(5, 1)))
      .toThrow('Duplicate fragment name "UserFields"')
  })

  it('silently skips duplicate fragment name with same body', () => {
    const doc = parse('fragment UserFields on User { id }')

    addDocumentToManifest(manifest, doc, sha256, makeLoc(1, 1))
    addDocumentToManifest(manifest, doc, sha256, makeLoc(10, 1))

    expect(Object.keys(manifest.fragments)).toHaveLength(1)
    expect(manifest.fragments.UserFields!.loc.start.line).toBe(1)
  })

  it('allows different operation names without error', () => {
    const doc1 = parse('query GetUser { user { id } }')
    const doc2 = parse('query ListUsers { users { id } }')

    addDocumentToManifest(manifest, doc1, sha256, makeLoc(1, 1))
    addDocumentToManifest(manifest, doc2, sha256, makeLoc(5, 1))

    expect(Object.keys(manifest.operations)).toHaveLength(2)
  })

  it('includes location info in duplicate operation error', () => {
    const doc1 = parse('query GetUser { user { id } }')
    const doc2 = parse('query GetUser { user { name } }')

    addDocumentToManifest(manifest, doc1, sha256, makeLoc(3, 7))

    try {
      addDocumentToManifest(manifest, doc2, sha256, makeLoc(9, 5))
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toContain('3:7')
      expect((err as Error).message).toContain('9:5')
    }
  })
})
