import type { DocumentNode } from 'graphql'
import type { ExtractManifest, ExtractResult, SkippedExtraction } from './manifest'
import { join } from 'node:path'
import { cwd as getCwd } from 'node:process'
import { findFiles, parseFile } from './files'
import { addDocumentToManifest } from './manifest'
import { processFileStatic, staticExtractCrossFile } from './analyze/pipeline'

export type { ExtractManifest, ExtractResult, ManifestEntry, SkippedExtraction } from './manifest'

export interface ExtractOptions {
  /** Directory to scan for source files. */
  dir: string
  /** Glob pattern for files to include. Defaults to `"**\/*.{ts,tsx,js,jsx,vue,svelte}"`. */
  include?: string
  /** Hash algorithm. Defaults to `"sha256"`. */
  algorithm?: string
  /** Working directory used to resolve `dir`. Defaults to `process.cwd()`. */
  cwd?: string
  /**
   * Path to tsconfig.json for cross-file partial/section resolution.
   * When provided, TypeScript module resolution is used to trace imports
   * of partials and sections across files, enabling extraction of operations
   * that reference partials defined in other files.
   *
   * Requires `typescript` to be installed as a dev dependency.
   */
  tsconfig?: string
}

/**
 * Scan source files for Gazania operations and return a persisted-query manifest.
 *
 * When `tsconfig` is provided, cross-file partial/section resolution is enabled:
 * files are processed in dependency order and partial definitions are propagated
 * between files via static AST analysis.
 *
 * @example
 * ```ts
 * import { extract } from 'gazania/extract'
 *
 * const { manifest } = await extract({ dir: 'src' })
 *
 * // With cross-file partial support:
 * const { manifest } = await extract({ dir: 'src', tsconfig: 'tsconfig.json' })
 * ```
 */
export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  const {
    dir,
    include = '**/*.{ts,tsx,js,jsx,vue,svelte}',
    algorithm = 'sha256',
    cwd = getCwd(),
    tsconfig,
  } = options

  const scanDir = join(cwd, dir)
  const files = await findFiles(scanDir, include)

  if (tsconfig) {
    return extractWithCrossFileResolution(files, algorithm, join(cwd, tsconfig))
  }

  return extractPerFile(files, algorithm)
}

/**
 * Original per-file extraction (no cross-file resolution).
 * Same-file partials/sections are still supported.
 */
async function extractPerFile(
  files: string[],
  algorithm: string,
): Promise<ExtractResult> {
  const manifest: ExtractManifest = {
    operations: {},
    fragments: {},
  }
  const allSkipped: SkippedExtraction[] = []

  for (const file of files) {
    const { documents, skipped } = await extractFromFile(file)
    for (const doc of documents) {
      addDocumentToManifest(manifest, doc, algorithm)
    }
    allSkipped.push(...skipped)
  }

  return { manifest, skipped: allSkipped }
}

/**
 * Cross-file extraction using TypeScript module resolution.
 * Files are processed in dependency order so that partials defined in one file
 * are available when analyzing operations in other files.
 */
async function extractWithCrossFileResolution(
  files: string[],
  algorithm: string,
  tsconfigPath: string,
): Promise<ExtractResult> {
  return staticExtractCrossFile(files, { tsconfigPath, algorithm })
}

async function extractFromFile(filePath: string): Promise<{ documents: DocumentNode[], skipped: SkippedExtraction[] }> {
  const blocks = await parseFile(filePath)
  if (!blocks) {
    return { documents: [], skipped: [] }
  }

  const result = processFileStatic(
    blocks,
    filePath,
    new Map(),
    [],
  )

  return { documents: result.documents, skipped: result.skipped }
}


