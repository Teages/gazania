import type { DocumentNode } from 'graphql'
import { print } from 'graphql'

export interface SourceLocation {
  line: number
  column: number
  offset: number
}

export interface SourceLoc {
  file: string
  start: SourceLocation
  end: SourceLocation
}

export interface ManifestEntry {
  body: string
  hash: string
  locs: SourceLoc[]
  schemaHash?: string
}

export type FragmentMode = 'fragment' | 'partial' | 'section'

export interface FragmentSourceLoc extends SourceLoc {
  fragmentMode: FragmentMode
}

export interface ManifestFragmentEntry extends Omit<ManifestEntry, 'locs'> {
  locs: FragmentSourceLoc[]
}

export interface ExtractManifest {
  operations: Record<string, ManifestEntry>
  fragments: Record<string, ManifestFragmentEntry>
}

export type SkippedExtractionCategory = 'unresolved' | 'analysis' | 'circular'

export interface SkippedExtraction {
  /** Absolute path of the file containing the skipped call */
  file: string
  /** 1-based line number in the original source file */
  line: number
  /** Error message from the failed evaluation */
  reason: string
  category: SkippedExtractionCategory
}

export interface ExtractResult {
  manifest: ExtractManifest
  /** Gazania calls that were detected but could not be statically evaluated */
  skipped: SkippedExtraction[]
}

export class ExtractionError extends Error {
  readonly skipped: SkippedExtraction[]
  constructor(skipped: SkippedExtraction[]) {
    super(`Extraction failed with ${skipped.length} skipped item(s)`)
    this.name = 'ExtractionError'
    this.skipped = skipped
  }
}

export type HashFn = (body: string) => string

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
  hash: HashFn,
  loc: SourceLoc,
  mode?: FragmentMode,
  schemaHash?: string,
): void {
  const body = print(doc)
  const hashStr = hash(body)
  const { name, type } = getOperationName(doc)

  if (!name) {
    const HASH_PREFIX_LENGTH = 8
    const hashStart = hashStr.indexOf(':') + 1
    let anonKey = `Anonymous_${hashStr.slice(hashStart, hashStart + HASH_PREFIX_LENGTH)}`
    const existing = manifest.operations[anonKey]
    if (existing) {
      if (existing.hash === hashStr && existing.schemaHash === schemaHash) {
        existing.locs.push(loc)
        return
      }
      // Hash collision or different schema — extend prefix until unique
      for (let len = HASH_PREFIX_LENGTH + 1; len <= hashStr.length - hashStart; len++) {
        anonKey = `Anonymous_${hashStr.slice(hashStart, hashStart + len)}`
        if (!manifest.operations[anonKey]) {
          break
        }
        if (manifest.operations[anonKey]!.hash === hashStr && manifest.operations[anonKey]!.schemaHash === schemaHash) {
          manifest.operations[anonKey]!.locs.push(loc)
          return
        }
      }
    }
    manifest.operations[anonKey] = { body, hash: hashStr, locs: [loc], schemaHash }
  }
  else if (type === 'fragment') {
    const fragmentMode: FragmentMode = mode ?? 'fragment'
    const existing = manifest.fragments[name]
    if (existing) {
      if (existing.hash === hashStr && existing.schemaHash === schemaHash) {
        existing.locs.push({ ...loc, fragmentMode })
        return
      }
      throw new Error(
        `Duplicate fragment name "${name}": first defined at ${existing.locs[0]!.start.line}:${existing.locs[0]!.start.column}, redefined at ${loc.start.line}:${loc.start.column}`,
      )
    }
    manifest.fragments[name] = { body, hash: hashStr, locs: [{ ...loc, fragmentMode }], schemaHash }
  }
  else {
    const existing = manifest.operations[name]
    if (existing) {
      if (existing.hash === hashStr && existing.schemaHash === schemaHash) {
        existing.locs.push(loc)
        return
      }
      throw new Error(
        `Duplicate operation name "${name}": first defined at ${existing.locs[0]!.start.line}:${existing.locs[0]!.start.column}, redefined at ${loc.start.line}:${loc.start.column}`,
      )
    }
    manifest.operations[name] = { body, hash: hashStr, locs: [loc], schemaHash }
  }
}
