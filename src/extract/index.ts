import type { ExtractResult, HashFn, SkippedExtractionCategory } from './manifest'
import { join } from 'node:path'
import process from 'node:process'
import { staticExtractCrossFile } from './analyze/pipeline'
import { findFiles } from './files'
import { ExtractionError } from './manifest'
import { adaptToSystem, loadTS } from './ts-program'

export type { ExtractManifest, ExtractResult, HashFn, ManifestEntry, SkippedExtraction } from './manifest'
export type { CreateHostFn, ExtractFS } from './ts-program'

export interface ExtractLogger {
  debug: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

export interface ExtractOptions {
  /** Directory to scan for source files. */
  dir: string
  /** Glob pattern for files to include. Defaults to `"**\/*.{ts,tsx,js,jsx,vue,svelte}"`. */
  include?: string
  /** Hash function for computing operation identifiers. */
  hash: HashFn
  /** Working directory used to resolve `dir`. Defaults to `process.cwd()`. */
  cwd?: string
  /**
   * Path to tsconfig.json for cross-file partial/section resolution.
   * TypeScript module resolution is used to trace imports of partials and
   * sections across files, enabling extraction of operations that reference
   * partials defined in other files.
   *
   * Requires `typescript` to be installed as a dev dependency.
   */
  tsconfig: string
  /**
   * Categories of skipped extractions to ignore (suppress from throwing).
   * By default, any skipped extraction causes extract() to throw ExtractionError.
   */
  ignoreCategories?: SkippedExtractionCategory[]
  logger?: ExtractLogger
  /**
   * File-system interface for all file operations during extraction.
   * Defaults to `ts.sys` (Node.js real filesystem).
   *
   * All methods must be synchronous. For async environments, preload
   * files into an in-memory implementation before calling `extract()`.
   */
  fs?: import('./ts-program').ExtractFS
  /**
   * Override the default CompilerHost construction.
   * Receives the resolved `ts.System` (assembled from `fs` + `ts.sys` defaults)
   * and the parsed compiler options from tsconfig.
   *
   * Use this for advanced scenarios like custom module resolution,
   * SourceFile caching, or integrating with existing TS service instances.
   */
  createHost?: import('./ts-program').CreateHostFn
}

/**
 * Scan source files for Gazania operations and return a persisted-query manifest.
 *
 * Files are processed in dependency order using TypeScript module resolution
 * so that partial definitions are propagated between files via static AST
 * analysis combined with TypeChecker-based builder name detection.
 *
 * @example
 * ```ts
 * import { extract } from 'gazania/extract'
 *
 * const { manifest } = await extract({ dir: 'src', tsconfig: 'tsconfig.json' })
 * ```
 */
export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  const {
    dir,
    include = '**/*.{ts,tsx,js,jsx,vue,svelte}',
    hash,
    cwd = process.cwd(),
    tsconfig,
    ignoreCategories = [],
    logger,
    fs,
    createHost: createHostFn,
  } = options

  if (!tsconfig) {
    throw new Error('tsconfig is required for extraction. Provide it via extract({ tsconfig: "tsconfig.json" }) or CLI flag --tsconfig.')
  }

  const ts = await loadTS()
  const system = fs ? adaptToSystem(fs, ts) : ts.sys
  const scanDir = join(cwd, dir)
  const files = findFiles(scanDir, include, system)

  const result = staticExtractCrossFile(files, {
    tsconfigPath: join(cwd, tsconfig),
    hash,
    logger,
    system,
    createHost: createHostFn,
    ts,
  })

  const unignoredSkipped = result.skipped.filter(s => !ignoreCategories.includes(s.category))

  if (unignoredSkipped.length > 0) {
    throw new ExtractionError(unignoredSkipped)
  }

  return result
}
