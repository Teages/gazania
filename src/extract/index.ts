import type { ExtractResult, HashFn, SkippedExtractionCategory } from './manifest'
import { staticExtractCrossFile } from './analyze/pipeline'
import { findFiles } from './files'
import { ExtractionError } from './manifest'
import { createSvelteCompiler, createVueCompiler } from './sfc'
import { adaptToSystem, loadTS } from './ts-program'

export type { ExtractManifest, ExtractResult, HashFn, ManifestEntry, SkippedExtraction, SourceLoc } from './manifest'
export type { CreateHostFn, ExtractFS } from './ts-program'
export { parseTSConfig } from './ts-program'
export type { ValidationError, ValidationWarning } from './validate'
export { validateManifest } from './validate'

export interface ExtractLogger {
  debug: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

export interface ExtractOptions {
  /** Absolute path to directory to scan for source files. */
  dir: string
  /** Glob pattern for files to include. Defaults to `"**\/*.{ts,tsx,js,jsx,vue,svelte}"`. */
  include?: string
  /** Hash function for computing operation identifiers. */
  hash: HashFn
  /**
   * Parsed TypeScript configuration for cross-file partial/section resolution.
   * Use `parseTSConfig()` to create this from a tsconfig.json path.
   */
  tsconfig: import('typescript').ParsedCommandLine
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
 * import { extract, parseTSConfig } from 'gazania/extract'
 * import ts from 'typescript'
 *
 * const parsed = parseTSConfig(ts, 'tsconfig.json', ts.sys)
 * const { manifest } = await extract({ dir: '/project/src', tsconfig: parsed, hash })
 * ```
 */
export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  const {
    dir,
    include = '**/*.{ts,tsx,js,jsx,vue,svelte}',
    hash,
    tsconfig,
    ignoreCategories = [],
    logger,
    fs,
    createHost: createHostFn,
  } = options

  if (!tsconfig) {
    throw new Error('tsconfig is required for extraction. Provide it via extract({ tsconfig: parsed }) or CLI flag --tsconfig.')
  }

  const ts = await loadTS()
  const system = fs ? adaptToSystem(fs, ts) : ts.sys
  const files = findFiles(dir, include, system)

  const compilers: import('./sfc').SFCCompiler[] = []

  if (files.some(f => f.endsWith('.vue'))) {
    const vueCompiler = await createVueCompiler()
    if (vueCompiler) {
      compilers.push(vueCompiler)
    }
    else {
      logger?.warn('Vue compiler not found. .vue files will be skipped. Install "vue/compiler-sfc" to enable extraction from Vue SFCs.')
    }
  }
  if (files.some(f => f.endsWith('.svelte'))) {
    const svelteCompiler = await createSvelteCompiler()
    if (svelteCompiler) {
      compilers.push(svelteCompiler)
    }
    else {
      logger?.warn('Svelte compiler not found. .svelte files will be skipped. Install "svelte2tsx" to enable extraction from Svelte components.')
    }
  }

  const result = staticExtractCrossFile(files, {
    tsconfig,
    hash,
    logger,
    system,
    createHost: createHostFn,
    ts,
    compilers,
  })

  const unignoredSkipped = result.skipped.filter(s => !ignoreCategories.includes(s.category))

  if (unignoredSkipped.length > 0) {
    throw new ExtractionError(unignoredSkipped)
  }

  return result
}
