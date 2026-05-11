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
import type _VueCompilerSfc from 'vue/compiler-sfc'

type VueCompilerSfc = typeof _VueCompilerSfc

export type VueCompilerApi = Pick<VueCompilerSfc, 'parse' | 'compileScript'>

/**
 * Try to load `vue/compiler-sfc` from the user's project.
 * Returns `null` if Vue is not installed (e.g. non-Vue projects).
 */
export async function tryLoadVueCompiler(): Promise<VueCompilerApi | null> {
  try {
    const sfc = await import('vue/compiler-sfc') as VueCompilerSfc | { default: VueCompilerSfc }
    const api = 'default' in sfc ? sfc.default : sfc
    return { parse: api.parse, compileScript: api.compileScript }
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
export interface VirtualFileEntry {
  content: string
  map?: { version: number, sources: string[], mappings: string, names?: string[], sourcesContent?: (string | null)[] }
}

export function buildVueVirtualFiles(
  vueFiles: string[],
  system: import('typescript').System,
  vueCompiler: VueCompilerApi,
): Map<string, VirtualFileEntry> {
  const virtualFiles = new Map<string, VirtualFileEntry>()
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
      virtualFiles.set(`${file}.ts`, { content: result.content, map: result.map ?? undefined })
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
  virtualFiles: Map<string, VirtualFileEntry>,
): import('typescript').CompilerHost {
  const origReadFile = host.readFile.bind(host)
  const origFileExists = host.fileExists?.bind(host) ?? ((f: string) => system.fileExists(f))
  host.readFile = f => virtualFiles.get(f)?.content ?? origReadFile(f)
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
  virtualFiles?: Map<string, VirtualFileEntry>,
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
  virtualFiles?: Map<string, VirtualFileEntry>,
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

  describe('tryLoadVueCompiler', () => {
    it('returns a VueCompilerApi when vue is installed', async () => {
      const result = await tryLoadVueCompiler()
      expect(result).not.toBeNull()
      expect(typeof result!.parse).toBe('function')
      expect(typeof result!.compileScript).toBe('function')
    })
  })

  describe('buildVueVirtualFiles', async () => {
    const { createTestingSystem } = await import('../../test/utils/vfs')

    function makeMockCompiler(
      compiled: string,
      opts?: { errors?: any[], noScript?: boolean, throwOnCompile?: boolean },
    ): VueCompilerApi {
      return {
        parse: (source, { filename }) => ({
          descriptor: {
            script: opts?.noScript ? null : { content: source },
            scriptSetup: null,
            filename,
          },
          errors: opts?.errors ?? [],
        }),
        compileScript: () => {
          if (opts?.throwOnCompile) {
            throw new Error('compile error')
          }
          return { content: compiled }
        },
      }
    }

    it('compiles .vue files into virtual .vue.ts entries', async () => {
      const ts = await loadTS()
      const dir = '/vfs/vue-virtual'
      const system = createTestingSystem({
        [`${dir}/Comp.vue`]: '<script>\nexport default {}\n</script>',
      }, ts)
      const mockCompiler = makeMockCompiler('export default {}')
      const result = buildVueVirtualFiles([`${dir}/Comp.vue`], system, mockCompiler)
      expect(result.has(`${dir}/Comp.vue.ts`)).toBe(true)
      expect(result.get(`${dir}/Comp.vue.ts`)?.content).toBe('export default {}')
    })

    it('skips non-.vue files in the input list', async () => {
      const ts = await loadTS()
      const dir = '/vfs/vue-virtual'
      const system = createTestingSystem({
        [`${dir}/App.svelte`]: '<script>\nexport let x = 1\n</script>',
      }, ts)
      const mockCompiler = makeMockCompiler('export let x = 1')
      const result = buildVueVirtualFiles([`${dir}/App.svelte`], system, mockCompiler)
      expect(result.size).toBe(0)
    })

    it('skips .vue files not present on the system', async () => {
      const ts = await loadTS()
      const system = createTestingSystem({}, ts)
      const mockCompiler = makeMockCompiler('export default {}')
      const result = buildVueVirtualFiles(['/nonexistent/Missing.vue'], system, mockCompiler)
      expect(result.size).toBe(0)
    })

    it('skips files with parse errors', async () => {
      const ts = await loadTS()
      const dir = '/vfs/vue-virtual'
      const system = createTestingSystem({
        [`${dir}/Broken.vue`]: '<script>broken',
      }, ts)
      const mockCompiler = makeMockCompiler('', { errors: [new Error('parse error')] })
      const result = buildVueVirtualFiles([`${dir}/Broken.vue`], system, mockCompiler)
      expect(result.size).toBe(0)
    })

    it('skips files with no script or scriptSetup block', async () => {
      const ts = await loadTS()
      const dir = '/vfs/vue-virtual'
      const system = createTestingSystem({
        [`${dir}/TemplateOnly.vue`]: '<template><div/></template>',
      }, ts)
      const mockCompiler = makeMockCompiler('', { noScript: true })
      const result = buildVueVirtualFiles([`${dir}/TemplateOnly.vue`], system, mockCompiler)
      expect(result.size).toBe(0)
    })

    it('skips files where compileScript throws', async () => {
      const ts = await loadTS()
      const dir = '/vfs/vue-virtual'
      const system = createTestingSystem({
        [`${dir}/Throws.vue`]: '<script>export default {}</script>',
      }, ts)
      const mockCompiler = makeMockCompiler('', { throwOnCompile: true })
      const result = buildVueVirtualFiles([`${dir}/Throws.vue`], system, mockCompiler)
      expect(result.size).toBe(0)
    })

    it('handles multiple .vue files', async () => {
      const ts = await loadTS()
      const dir = '/vfs/vue-virtual'
      const system = createTestingSystem({
        [`${dir}/A.vue`]: '<script>export const a = 1</script>',
        [`${dir}/B.vue`]: '<script>export const b = 2</script>',
      }, ts)
      const mockCompiler = makeMockCompiler('compiled')
      const result = buildVueVirtualFiles(
        [`${dir}/A.vue`, `${dir}/B.vue`],
        system,
        mockCompiler,
      )
      expect(result.has(`${dir}/A.vue.ts`)).toBe(true)
      expect(result.has(`${dir}/B.vue.ts`)).toBe(true)
    })
  })

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

    it('resolves .vue imports to .vue path when virtual .vue.ts files are provided', async () => {
      const ts = await loadTS()
      const dir = '/vfs/ts-program-vue'
      const virtualFiles = new Map([
        [`${dir}/src/Comp.vue.ts`, 'export default {}'],
      ])
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
        [`${dir}/src/index.ts`]: 'import Comp from \'./Comp.vue\'',
      }, ts)

      const parsed = parseTSConfig(ts, `${dir}/tsconfig.json`, system)
      const resolver = createModuleResolver(ts, parsed, system, undefined, virtualFiles)
      const resolved = resolver.resolve('./Comp.vue', `${dir}/src/index.ts`)

      // The resolved path should be the .vue path, not .vue.ts
      expect(resolved).toBe(`${dir}/src/Comp.vue`)
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

    it('includes virtual files in the program when provided', async () => {
      const ts = await loadTS()
      const dir = '/vfs/ts-program-virtual'
      const virtualContent = 'export const virtualVar = 42'
      const virtualFiles = new Map([
        [`${dir}/src/Comp.vue.ts`, { content: virtualContent }],
      ])
      const system = createTestingSystem({
        [`${dir}/tsconfig.json`]: JSON.stringify({
          compilerOptions: { target: 'esnext', module: 'esnext', moduleResolution: 'bundler', strict: true },
          files: [`${dir}/src/index.ts`],
        }),
        [`${dir}/src/index.ts`]: 'export const x = 1',
      }, ts)

      const parsed = parseTSConfig(ts, `${dir}/tsconfig.json`, system)
      const { program } = createTypeCheckerProgram(ts, parsed, system, undefined, virtualFiles)

      const sourceFilePaths = program.getSourceFiles().map(f => f.fileName)
      expect(sourceFilePaths).toContain(`${dir}/src/Comp.vue.ts`)
    })
  })
}
