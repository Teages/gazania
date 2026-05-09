import { dirname, resolve } from 'node:path'

export interface ModuleResolver {
  /**
   * Resolve an import specifier to an absolute file path.
   * Returns `undefined` if the module cannot be resolved.
   */
  resolve: (modulePath: string, fromFile: string) => string | undefined
}

/**
 * Create a module resolver using TypeScript's module resolution algorithm.
 * Requires `typescript` to be installed (lazy-loaded).
 *
 * @param tsconfigPath - Absolute or relative path to tsconfig.json
 * @throws If TypeScript is not installed or tsconfig cannot be read
 */
export async function createModuleResolver(tsconfigPath: string): Promise<ModuleResolver> {
  let ts: typeof import('typescript')

  try {
    ts = await import('typescript').then(m => ('default' in m ? m.default : m) as typeof import('typescript'))
  }
  catch {
    throw new Error(
      'TypeScript is required for cross-file extraction (--tsconfig). '
      + 'Install it with: npm install -D typescript',
    )
  }

  const configPath = resolve(tsconfigPath)
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

  if (configFile.error) {
    const msg = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')
    throw new Error(`Failed to read tsconfig at "${configPath}": ${msg}`)
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirname(configPath),
  )

  if (parsed.errors.length > 0) {
    const fatalErrors = parsed.errors.filter(e => e.code !== 18003)
    if (fatalErrors.length > 0) {
      const msg = ts.flattenDiagnosticMessageText(fatalErrors[0].messageText, '\n')
      throw new Error(`Invalid tsconfig at "${configPath}": ${msg}`)
    }
  }

  const host = ts.createCompilerHost(parsed.options)

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
}

export async function createTypeCheckerProgram(tsconfigPath: string): Promise<TypeCheckerProgram> {
  let ts: typeof import('typescript')

  try {
    ts = await import('typescript').then(m => ('default' in m ? m.default : m) as typeof import('typescript'))
  }
  catch {
    throw new Error(
      'TypeScript is required for cross-file extraction (--tsconfig). '
      + 'Install it with: npm install -D typescript',
    )
  }

  const configPath = resolve(tsconfigPath)
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

  if (configFile.error) {
    const msg = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')
    throw new Error(`Failed to read tsconfig at "${configPath}": ${msg}`)
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirname(configPath),
  )

  if (parsed.errors.length > 0) {
    const fatalErrors = parsed.errors.filter(e => e.code !== 18003)
    if (fatalErrors.length > 0) {
      const msg = ts.flattenDiagnosticMessageText(fatalErrors[0].messageText, '\n')
      throw new Error(`Invalid tsconfig at "${configPath}": ${msg}`)
    }
  }

  const host = ts.createCompilerHost(parsed.options)
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    host,
  })

  return {
    program,
    checker: program.getTypeChecker(),
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

      const resolver = await createModuleResolver(join(dir, 'tsconfig.json'))
      const resolved = resolver.resolve('./fragments/user', join(dir, 'src', 'index.ts'))

      expect(resolved).toBe(join(dir, 'src', 'fragments', 'user.ts'))
    })

    it('returns undefined for unresolvable modules', async () => {
      await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'esnext',
          module: 'esnext',
          moduleResolution: 'bundler',
          strict: true,
        },
        include: ['src'],
      }))

      const resolver = await createModuleResolver(join(dir, 'tsconfig.json'))
      const resolved = resolver.resolve('./nonexistent', join(dir, 'src', 'index.ts'))

      expect(resolved).toBeUndefined()
    })

    it('throws on invalid tsconfig path', async () => {
      await expect(
        createModuleResolver(join(dir, 'nonexistent.json')),
      ).rejects.toThrow('Failed to read tsconfig')
    })
  })

  describe('createTypeCheckerProgram', () => {
    it('returns program with TypeChecker', async () => {
      const { program, checker } = await createTypeCheckerProgram('tsconfig.json')

      expect(program).toBeDefined()
      expect(checker).toBeDefined()
      expect(typeof checker.getTypeAtLocation).toBe('function')
    })

    it('has source files from the project', { timeout: 30_000 }, async () => {
      const { program } = await createTypeCheckerProgram('tsconfig.node.json')

      expect(program.getSourceFiles().length).toBeGreaterThan(0)
    })

    it('throws on invalid tsconfig path', async () => {
      await expect(
        createTypeCheckerProgram(join(tmpdir(), 'nonexistent.json')),
      ).rejects.toThrow('Failed to read tsconfig')
    })
  })
}
