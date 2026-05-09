import type { ExtractManifest, ExtractResult, SkippedExtraction } from './manifest'
import { join } from 'node:path'
import { cwd as getCwd } from 'node:process'
import { findFiles } from './files'
import { staticExtractCrossFile } from './analyze/pipeline'

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
   * TypeScript module resolution is used to trace imports of partials and
   * sections across files, enabling extraction of operations that reference
   * partials defined in other files.
   *
   * Requires `typescript` to be installed as a dev dependency.
   */
  tsconfig: string
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
    algorithm = 'sha256',
    cwd = getCwd(),
    tsconfig,
  } = options

  if (!tsconfig) {
    throw new Error('tsconfig is required for extraction. Provide it via extract({ tsconfig: "tsconfig.json" }) or CLI flag --tsconfig.')
  }

  const scanDir = join(cwd, dir)
  const files = await findFiles(scanDir, include)

  return staticExtractCrossFile(files, { tsconfigPath: join(cwd, tsconfig), algorithm })
}
