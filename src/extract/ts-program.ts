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
 * Minimal API surface of `vue/compiler-sfc` that Gazania needs.
 * Loaded lazily so Vue is not a hard dependency.
 */
export interface VueCompilerApi {
  parse: (source: string, options: { filename: string }) => { descriptor: any, errors: any[] }
  compileScript: (descriptor: any, options: { id: string }) => { content: string }
}

/**
 * Try to load `vue/compiler-sfc` from the user's project.
 * Returns `null` if Vue is not installed (e.g. non-Vue projects).
 */
export async function tryLoadVueCompiler(): Promise<VueCompilerApi | null> {
  try {
    const sfc = await import('vue/compiler-sfc')
    const api: any = 'default' in sfc ? (sfc as any).default : sfc
    return {
      parse: api.parse ?? (sfc as any).parse,
      compileScript: api.compileScript ?? (sfc as any).compileScript,
    }
  }
  catch {
    return null
  }
}

/**
 * Compile Vue SFC files to virtual `.vue.ts` files using the Vue compiler.
 * Returns a map of `<original>.vue.ts` → compiled TypeScript content.
 *
 * These virtual files are injected into the TypeScript CompilerHost so that
 * imports like `'./Comp.vue'` resolve naturally to `'./Comp.vue.ts'`, giving
 * the TypeChecker full type information for SFC exports and auto-imported
 * globals (e.g. Nuxt's `declare global { const schema: ... }`).
 */
export function buildVueVirtualFiles(
  vueFiles: string[],
  system: import('typescript').System,
  vueCompiler: VueCompilerApi,
): Map<string, string> {
  const virtualFiles = new Map<string, string>()
  for (const file of vueFiles) {
    if (!file.endsWith('.vue')) {
      continue
    }
    const source = system.readFile(file)
    if (!source) {
      continue
    }
    try {
      const { descriptor, errors } = vueCompiler.parse(source, { filename: file })
      if (errors.length > 0 || (!descriptor.script && !descriptor.scriptSetup)) {
        continue
      }
      const result = vueCompiler.compileScript(descriptor, { id: file })
      virtualFiles.set(`${file}.ts`, result.content)
    }
    catch {
      // Skip files that cannot be compiled; they fall back to AST-only analysis.
    }
  }
  return virtualFiles
}

/**
 * Overlay virtual files onto a CompilerHost.
 * Mutates the host in-place (rather than spreading) to preserve the prototype
 * chain — `ts.createCompilerHost` puts methods like `getCanonicalFileName` on
 * the prototype, which a spread `{ ...host }` would silently drop.
 */
function overlayVirtualFiles(
  host: import('typescript').CompilerHost,
  system: import('typescript').System,
  virtualFiles: Map<string, string>,
): import('typescript').CompilerHost {
  const origReadFile = host.readFile.bind(host)
  const origFileExists = host.fileExists?.bind(host) ?? ((f: string) => system.fileExists(f))
  host.readFile = f => virtualFiles.get(f) ?? origReadFile(f)
  host.fileExists = f => virtualFiles.has(f) || origFileExists(f)
  return host
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
 *
 * When virtual `.vue.ts` files are provided (via `buildVueVirtualFiles`),
 * TypeScript's Bundler-mode resolution naturally resolves `'./Comp.vue'` to
 * `'./Comp.vue.ts'`.  The resolved path is stripped back to `'./Comp.vue'`
 * so that dependency-graph keys stay consistent with the scanned file list.
 */
export function createModuleResolver(
  ts: typeof import('typescript'),
  parsed: import('typescript').ParsedCommandLine,
  system: import('typescript').System,
  createHostFn?: CreateHostFn,
  virtualFiles?: Map<string, string>,
): ModuleResolver {
  const baseHost = createHostFn
    ? createHostFn(ts, system, parsed.options)
    : createHostFromSystem(ts, system, parsed.options)
  const host = virtualFiles && virtualFiles.size > 0
    ? overlayVirtualFiles(baseHost, system, virtualFiles)
    : baseHost

  return {
    resolve(modulePath: string, fromFile: string): string | undefined {
      const result = ts.resolveModuleName(modulePath, fromFile, parsed.options, host)
      const resolved = result.resolvedModule?.resolvedFileName
      if (!resolved) {
        return undefined
      }
      // TypeScript (Bundler mode) resolves './Comp.vue' → 'Comp.vue.ts'.
      // Strip the extra '.ts' suffix so dependency-graph keys stay as '.vue' paths.
      if (resolved.endsWith('.vue.ts') || resolved.endsWith('.svelte.ts')) {
        return resolved.slice(0, -3)
      }
      return resolved
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
 *
 * When `virtualFiles` are provided (compiled Vue SFC scripts), they are
 * overlaid on the CompilerHost and their paths are added to `rootNames` so
 * the TypeChecker can resolve types across SFC boundaries.
 */
export function createTypeCheckerProgram(
  ts: typeof import('typescript'),
  parsed: import('typescript').ParsedCommandLine,
  system: import('typescript').System,
  createHostFn?: CreateHostFn,
  virtualFiles?: Map<string, string>,
): TypeCheckerProgram {
  const baseHost = createHostFn
    ? createHostFn(ts, system, parsed.options)
    : createHostFromSystem(ts, system, parsed.options)
  const host = virtualFiles && virtualFiles.size > 0
    ? overlayVirtualFiles(baseHost, system, virtualFiles)
    : baseHost
  const rootNames = [
    ...parsed.fileNames,
    ...(virtualFiles ? [...virtualFiles.keys()] : []),
  ]
  const program = ts.createProgram({ rootNames, options: parsed.options, host })

  return {
    program,
    checker: program.getTypeChecker(),
    host,
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('createModuleResolver', async () => {
    const { createTestingSystem } = await import('../../test/utils/vfs')

    it('resolves relative imports between TypeScript files', async () => {
      const ts = await loadTS()
      const dir = '/vfs/ts-program'
      const system = createTestingSystem({
        [`${dir}/tsconfig.json`]: JSON.stringify({
          compilerOptions: {
            target: 'esnext',
            module: 'esnext',
            moduleResolution: 'bundler',
            strict: true,
          },
          include: ['src'],
        }),
        [`${dir}/src/fragments/user.ts`]: 'export const x = 1',
        [`${dir}/src/index.ts`]: 'import { x } from \'./fragments/user\'',
      }, ts)

      const parsed = parseTSConfig(ts, `${dir}/tsconfig.json`, system)
      const resolver = createModuleResolver(ts, parsed, system)
      const resolved = resolver.resolve('./fragments/user', `${dir}/src/index.ts`)

      expect(resolved).toBe(`${dir}/src/fragments/user.ts`)
    })

    it('returns undefined for unresolvable modules', async () => {
      const ts = await loadTS()
      const dir = '/vfs/ts-program'
      const system = createTestingSystem({
        [`${dir}/tsconfig.json`]: JSON.stringify({
          compilerOptions: {
            target: 'esnext',
            module: 'esnext',
            moduleResolution: 'bundler',
            strict: true,
          },
          include: ['src'],
        }),
      }, ts)

      const parsed = parseTSConfig(ts, `${dir}/tsconfig.json`, system)
      const resolver = createModuleResolver(ts, parsed, system)
      const resolved = resolver.resolve('./nonexistent', `${dir}/src/index.ts`)

      expect(resolved).toBeUndefined()
    })

    it('throws on invalid tsconfig path', async () => {
      const ts = await loadTS()
      expect(
        () => parseTSConfig(ts, '/vfs/nonexistent.json', createTestingSystem({}, ts)),
      ).toThrow('Failed to read tsconfig')
    })
  })

  describe('createTypeCheckerProgram', async () => {
    const { createTestingSystem } = await import('../../test/utils/vfs')

    it('returns program with TypeChecker', async () => {
      const ts = await loadTS()
      const system = createTestingSystem({
        '/vfs/tsconfig.json': JSON.stringify({
          compilerOptions: { target: 'esnext', module: 'esnext', moduleResolution: 'bundler', strict: true },
          files: ['/vfs/a.ts'],
        }),
        '/vfs/a.ts': 'export const x = 1',
      }, ts)
      const parsed = parseTSConfig(ts, '/vfs/tsconfig.json', system)
      const { program, checker } = createTypeCheckerProgram(ts, parsed, system)

      expect(program).toBeDefined()
      expect(checker).toBeDefined()
      expect(typeof checker.getTypeAtLocation).toBe('function')
    })

    it('has source files matching the virtual file system', async () => {
      const ts = await loadTS()
      const system = createTestingSystem({
        '/vfs/tsconfig.json': JSON.stringify({
          compilerOptions: { target: 'esnext', module: 'esnext', moduleResolution: 'bundler', strict: true },
          files: ['/vfs/a.ts'],
        }),
        '/vfs/a.ts': 'export const x = 1',
      }, ts)
      const parsed = parseTSConfig(ts, '/vfs/tsconfig.json', system)
      const { program } = createTypeCheckerProgram(ts, parsed, system)

      expect(program.getSourceFiles().length).toBeGreaterThan(0)
    })

    it('throws on invalid tsconfig path', async () => {
      const ts = await loadTS()
      expect(
        () => parseTSConfig(ts, '/vfs/nonexistent.json', createTestingSystem({}, ts)),
      ).toThrow('Failed to read tsconfig')
    })
  })
}
