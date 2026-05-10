/**
 * Minimal synchronous file-system interface for extract operations.
 * All methods are synchronous because TypeScript's compiler API is synchronous.
 *
 * `ts.sys` satisfies this interface in Node.js environments.
 * For virtual/test environments, preload files into memory before passing.
 */
export interface ExtractFS {
  /** Read file contents. Return `undefined` if file doesn't exist. */
  readFile: (path: string) => string | undefined
  /**
   * Recursively list files in a directory, filtered by extensions.
   * Should exclude `node_modules` and `.git` directories.
   * Signature matches `ts.System.readDirectory`.
   */
  readDirectory: (
    path: string,
    extensions?: readonly string[],
    excludes?: readonly string[] | undefined,
    includes?: readonly string[] | undefined,
    depth?: number,
  ) => string[]
  /**
   * Check if a file exists. Optional — if not provided, falls back to
   * `readFile(path) !== undefined`. Providing this is recommended for performance.
   */
  fileExists?: (path: string) => boolean
}

export type CreateHostFn = (
  ts: typeof import('typescript'),
  system: import('typescript').System,
  compilerOptions: import('typescript').CompilerOptions,
) => import('typescript').CompilerHost

export interface ModuleResolver {
  /**
   * Resolve an import specifier to an absolute file path.
   * Returns `undefined` if the module cannot be resolved.
   */
  resolve: (modulePath: string, fromFile: string) => string | undefined
}

/**
 * Load TypeScript lazily. Throws if not installed.
 */
export async function loadTS(): Promise<typeof import('typescript')> {
  try {
    return await import('typescript').then(m => ('default' in m ? m.default : m) as typeof import('typescript'))
  }
  catch {
    throw new Error(
      'TypeScript is required for extraction (--tsconfig). '
      + 'Install it with: npm install -D typescript',
    )
  }
}

/**
 * Parse a tsconfig.json file into a ParsedCommandLine.
 * Uses `ts.System.resolvePath` for path resolution and string operations
 * for dirname extraction — no `node:path` dependency needed.
 */
export function parseTSConfig(
  ts: typeof import('typescript'),
  tsconfigPath: string,
  system: import('typescript').System,
): import('typescript').ParsedCommandLine {
  const configPath = system.resolvePath(tsconfigPath)
  const configFile = ts.readConfigFile(configPath, system.readFile)
  if (configFile.error) {
    const msg = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')
    throw new Error(`Failed to read tsconfig at "${configPath}": ${msg}`)
  }
  const dirPath = configPath.includes('/') ? configPath.substring(0, configPath.lastIndexOf('/')) : '.'
  const parsed = ts.parseJsonConfigFileContent(configFile.config, system, dirPath)
  if (parsed.errors.length > 0) {
    const fatalErrors = parsed.errors.filter(e => e.code !== 18003)
    if (fatalErrors.length > 0) {
      const msg = ts.flattenDiagnosticMessageText(fatalErrors[0].messageText, '\n')
      throw new Error(`Invalid tsconfig at "${configPath}": ${msg}`)
    }
  }
  return parsed
}

/**
 * Adapt a user-provided ExtractFS into a ts.System.
 * FS methods (readFile, readDirectory, fileExists) come from user's fs.
 * Metadata methods (getCurrentDirectory, newLine, etc.) fallback to ts.sys.
 */
export function adaptToSystem(fs: ExtractFS, ts: typeof import('typescript')): import('typescript').System {
  return {
    ...ts.sys,
    readFile: fs.readFile,
    readDirectory: fs.readDirectory,
    fileExists: fs.fileExists ?? ((path: string) => fs.readFile(path) !== undefined),
  }
}

/**
 * Create a CompilerHost that delegates FS operations to the given System.
 * Used when user provides a custom fs but not a custom createHost.
 */
export function createHostFromSystem(
  ts: typeof import('typescript'),
  system: import('typescript').System,
  options: import('typescript').CompilerOptions,
): import('typescript').CompilerHost {
  const host = ts.createCompilerHost(options)
  host.readFile = fileName => system.readFile(fileName)
  host.fileExists = fileName => system.fileExists(fileName)
  if (system.readDirectory) {
    host.readDirectory = (rootDir, extensions, excludes, includes, depth) =>
      system.readDirectory(rootDir, extensions, excludes, includes, depth)
  }
  host.directoryExists = dir => system.directoryExists(dir)
  if (system.getDirectories) {
    host.getDirectories = path => system.getDirectories(path)
  }
  host.getCurrentDirectory = () => system.getCurrentDirectory()
  return host
}

/**
 * Create a module resolver using TypeScript's module resolution algorithm.
 * Accepts a pre-parsed `ParsedCommandLine` (from `parseTSConfig`).
 */
export function createModuleResolver(
  ts: typeof import('typescript'),
  parsed: import('typescript').ParsedCommandLine,
  system: import('typescript').System,
  createHostFn?: CreateHostFn,
): ModuleResolver {
  const host = createHostFn
    ? createHostFn(ts, system, parsed.options)
    : createHostFromSystem(ts, system, parsed.options)

  return {
    resolve(modulePath: string, fromFile: string): string | undefined {
      const result = ts.resolveModuleName(modulePath, fromFile, parsed.options, host)
      return result.resolvedModule?.resolvedFileName
    },
  }
}

export interface TypeCheckerProgram {
  program: import('typescript').Program
  checker: import('typescript').TypeChecker
  host: import('typescript').CompilerHost
}

/**
 * Create a TypeScript program with TypeChecker for builder name detection.
 * Accepts a pre-parsed `ParsedCommandLine` (from `parseTSConfig`).
 */
export function createTypeCheckerProgram(
  ts: typeof import('typescript'),
  parsed: import('typescript').ParsedCommandLine,
  system: import('typescript').System,
  createHostFn?: CreateHostFn,
): TypeCheckerProgram {
  const host = createHostFn
    ? createHostFn(ts, system, parsed.options)
    : createHostFromSystem(ts, system, parsed.options)
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    host,
  })

  return {
    program,
    checker: program.getTypeChecker(),
    host,
  }
}

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach, afterEach } = import.meta.vitest
  // eslint-disable-next-line antfu/no-top-level-await
  const { mkdir, rm, writeFile } = await import('node:fs/promises')
  // eslint-disable-next-line antfu/no-top-level-await
  const { randomUUID } = await import('node:crypto')
  // eslint-disable-next-line antfu/no-top-level-await
  const { tmpdir } = await import('node:os')
  // eslint-disable-next-line antfu/no-top-level-await
  const { join } = await import('node:path')

  describe('createModuleResolver', () => {
    let dir: string

    beforeEach(async () => {
      dir = join(tmpdir(), `gazania-ts-program-test-${randomUUID()}`)
      await mkdir(dir, { recursive: true })
      await mkdir(join(dir, 'src'), { recursive: true })
      await mkdir(join(dir, 'src', 'fragments'), { recursive: true })
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
    })

    it('resolves relative imports between TypeScript files', async () => {
      const ts = await loadTS()
      await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'esnext',
          module: 'esnext',
          moduleResolution: 'bundler',
          strict: true,
        },
        include: ['src'],
      }))
      await writeFile(join(dir, 'src', 'fragments', 'user.ts'), `export const x = 1`)
      await writeFile(join(dir, 'src', 'index.ts'), `import { x } from './fragments/user'`)

      const parsed = parseTSConfig(ts, join(dir, 'tsconfig.json'), ts.sys)
      const resolver = createModuleResolver(ts, parsed, ts.sys)
      const resolved = resolver.resolve('./fragments/user', join(dir, 'src', 'index.ts'))

      expect(resolved).toBe(join(dir, 'src', 'fragments', 'user.ts'))
    })

    it('returns undefined for unresolvable modules', async () => {
      const ts = await loadTS()
      await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'esnext',
          module: 'esnext',
          moduleResolution: 'bundler',
          strict: true,
        },
        include: ['src'],
      }))

      const parsed = parseTSConfig(ts, join(dir, 'tsconfig.json'), ts.sys)
      const resolver = createModuleResolver(ts, parsed, ts.sys)
      const resolved = resolver.resolve('./nonexistent', join(dir, 'src', 'index.ts'))

      expect(resolved).toBeUndefined()
    })

    it('throws on invalid tsconfig path', async () => {
      const ts = await loadTS()
      expect(
        () => parseTSConfig(ts, join(dir, 'nonexistent.json'), ts.sys),
      ).toThrow('Failed to read tsconfig')
    })
  })

  describe('createTypeCheckerProgram', () => {
    it('returns program with TypeChecker', async () => {
      const ts = await loadTS()
      const parsed = parseTSConfig(ts, 'tsconfig.json', ts.sys)
      const { program, checker } = createTypeCheckerProgram(ts, parsed, ts.sys)

      expect(program).toBeDefined()
      expect(checker).toBeDefined()
      expect(typeof checker.getTypeAtLocation).toBe('function')
    })

    it('has source files from the project', { timeout: 30_000 }, async () => {
      const ts = await loadTS()
      const parsed = parseTSConfig(ts, 'tsconfig.node.json', ts.sys)
      const { program } = createTypeCheckerProgram(ts, parsed, ts.sys)

      expect(program.getSourceFiles().length).toBeGreaterThan(0)
    })

    it('throws on invalid tsconfig path', async () => {
      const ts = await loadTS()
      expect(
        () => parseTSConfig(ts, join(tmpdir(), 'nonexistent.json'), ts.sys),
      ).toThrow('Failed to read tsconfig')
    })
  })
}
