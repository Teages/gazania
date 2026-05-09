import type { DocumentNode } from 'graphql'
import { createHash, getHashes } from 'node:crypto'
import { print } from 'graphql'

export interface ManifestEntry {
  body: string
  hash: string
}

export interface ExtractManifest {
  operations: Record<string, ManifestEntry>
  fragments: Record<string, ManifestEntry>
}

export interface SkippedExtraction {
  /** Absolute path of the file containing the skipped call */
  file: string
  /** 1-based line number in the original source file */
  line: number
  /** Error message from the failed evaluation */
  reason: string
}

export interface ExtractResult {
  manifest: ExtractManifest
  /** Gazania calls that were detected but could not be statically evaluated */
  skipped: SkippedExtraction[]
}

export function computeHash(body: string, algorithm: string): string {
  if (!getHashes().includes(algorithm)) {
    throw new Error(
      `Unsupported hash algorithm: "${algorithm}". `
      + `Supported algorithms: ${getHashes().join(', ')}`,
    )
  }
  const hash = createHash(algorithm).update(body).digest('hex')
  return `${algorithm}:${hash}`
}

export function getOperationName(doc: DocumentNode): { name: string | undefined, type: 'operation' | 'fragment' } {
  if (doc.definitions.length === 0) {
    return { name: undefined, type: 'operation' }
  }
  const firstDef = doc.definitions[0]!
  if (firstDef.kind === 'FragmentDefinition') {
    return { name: firstDef.name.value, type: 'fragment' }
  }
  if (firstDef.kind === 'OperationDefinition') {
    return { name: firstDef.name?.value, type: 'operation' }
  }
  return { name: undefined, type: 'operation' }
}

export function addDocumentToManifest(
  manifest: ExtractManifest,
  doc: DocumentNode,
  algorithm: string,
): void {
  const body = print(doc)
  const hash = computeHash(body, algorithm)
  const { name, type } = getOperationName(doc)

  if (!name) {
    const HASH_PREFIX_LENGTH = 8
    const hashStart = hash.indexOf(':') + 1
    const anonKey = `Anonymous_${hash.slice(hashStart, hashStart + HASH_PREFIX_LENGTH)}`
    manifest.operations[anonKey] = { body, hash }
  }
  else if (type === 'fragment') {
    manifest.fragments[name] = { body, hash }
  }
  else {
    manifest.operations[name] = { body, hash }
  }
}
