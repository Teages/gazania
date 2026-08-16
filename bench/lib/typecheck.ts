/**
 * Shared TypeScript type-checking harness for the bench suites.
 *
 * Each call creates a fresh program from an in-memory source string and runs
 * `getSemanticDiagnostics()` – the full type-inference pass.  A new compiler
 * host is constructed on every call so that caches do not carry over between
 * bench iterations.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// Compiler options that match the project's tsconfig.base.json.
// `types` includes `vitest/importMeta` so the `import.meta.vitest` guards in
// the library source files do not generate cascading errors.
export const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  types: ['vitest/importMeta'],
  typeRoots: [resolve(projectRoot, 'node_modules')],
}

export interface TypeCheckResult {
  diagnostics: ts.Diagnostic[]
  durationMs: number
}

/** Format diagnostics into a single readable error message. */
export function formatTypeErrors(scenario: string, diagnostics: ts.Diagnostic[]): string {
  const errors = diagnostics.map((d) => {
    const line = d.file && d.start !== undefined
      ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
      : 0
    return `  ${d.file?.fileName ?? '?'}:${line} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`
  })
  return `type bench scenario "${scenario}" does not type-check:\n${errors.join('\n')}`
}

/**
 * Create a `typeCheck(code)` function whose in-memory source lives at
 * `virtualFile`. Place the virtual file inside the real project layout so
 * relative imports (`../src/...`) resolve without absolute paths.
 */
export function createTypeCheck(virtualFile: string) {
  return function typeCheck(code: string): TypeCheckResult {
    const defaultHost = ts.createCompilerHost(COMPILER_OPTIONS)

    const customHost: ts.CompilerHost = {
      ...defaultHost,
      getSourceFile(fileName, languageVersion, ...rest) {
        if (fileName === virtualFile) {
          return ts.createSourceFile(fileName, code, languageVersion)
        }
        return defaultHost.getSourceFile(fileName, languageVersion, ...rest)
      },
      fileExists(fileName) {
        if (fileName === virtualFile) {
          return true
        }
        return defaultHost.fileExists(fileName)
      },
      readFile(fileName) {
        if (fileName === virtualFile) {
          return code
        }
        return defaultHost.readFile(fileName)
      },
    }

    const program = ts.createProgram({
      rootNames: [virtualFile],
      options: COMPILER_OPTIONS,
      host: customHost,
    })

    const start = performance.now()
    const diagnostics = program.getSemanticDiagnostics()
    const durationMs = performance.now() - start

    return { diagnostics: [...diagnostics], durationMs }
  }
}
