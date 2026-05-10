import type ts from 'typescript'

function hasGazaniaMarker(
  checker: ts.TypeChecker,
  type: ts.Type,
): boolean {
  const marker = checker.getPropertyOfType(type, '~isGazania')
  if (!marker) {
    return false
  }
  const markerType = checker.getTypeOfSymbol(marker)
  return checker.isTypeAssignableTo(markerType, checker.getTrueType())
}

/**
 * Walk a TS SourceFile and collect identifier names whose type carries
 * the ~isGazania marker. Uses the TypeChecker — no string matching.
 */
export function collectBuilderNamesByType(
  ts: typeof import('typescript'),
  program: ts.Program,
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
): { builderNames: string[], namespace: string | undefined } {
  const builderNames = new Set<string>()
  let namespace: string | undefined

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          detectNamespace(node, clause.namedBindings)
        }
        else if (ts.isNamedImports(clause.namedBindings)) {
          for (const spec of clause.namedBindings.elements) {
            detectImportSpecifier(spec)
          }
        }
      }
      return
    }

    if (ts.isVariableDeclaration(node)) {
      detectVariableDeclaration(node)
    }

    ts.forEachChild(node, visit)
  }

  function detectImportSpecifier(spec: ts.ImportSpecifier): void {
    const type = checker.getTypeAtLocation(spec.name)
    if (hasGazaniaMarker(checker, type)) {
      builderNames.add(spec.name.text)
    }
  }

  function detectNamespace(
    importDecl: ts.ImportDeclaration,
    nsNode: ts.NamespaceImport,
  ): void {
    const spec = importDecl.moduleSpecifier
    if (!ts.isStringLiteral(spec)) {
      return
    }

    const moduleSymbol = checker.getSymbolAtLocation(spec)
    if (!moduleSymbol) {
      return
    }

    const exports = checker.getExportsOfModule(moduleSymbol)
    for (const exp of exports) {
      if (hasGazaniaMarker(checker, checker.getTypeOfSymbol(exp))) {
        namespace = nsNode.name.text
        break
      }
    }
  }

  function detectVariableDeclaration(node: ts.VariableDeclaration): void {
    if (!node.initializer || !ts.isIdentifier(node.name)) {
      return
    }
    const type = checker.getTypeAtLocation(node.initializer)
    if (hasGazaniaMarker(checker, type)) {
      builderNames.add(node.name.text)
    }
  }

  ts.forEachChild(sourceFile, visit)
  return { builderNames: Array.from(builderNames), namespace }
}

/**
 * Convenience wrapper: resolve SourceFile by path, then delegate.
 */
export function collectBuilderNamesForFile(
  ts: typeof import('typescript'),
  program: ts.Program,
  checker: ts.TypeChecker,
  filePath: string,
): { builderNames: string[], namespace: string | undefined } {
  const sourceFile = program.getSourceFile(filePath)
  if (!sourceFile) {
    return { builderNames: [], namespace: undefined }
  }
  return collectBuilderNamesByType(ts, program, checker, sourceFile)
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('type-aware-ids', async () => {
    const ts = await import('typescript').then(m => ('default' in m ? m.default : m) as typeof import('typescript'))
    const { createTypeCheckerProgram, loadTS, parseTSConfig } = await import('../ts-program')
    const { createTestingSystem } = await import('../../../test/utils/vfs')

    const tsInstance = await loadTS()
    const projectRoot = tsInstance.sys.resolvePath(tsInstance.sys.getCurrentDirectory())

    function setupFixture(
      dir: string,
      code: string,
    ) {
      const files: Record<string, string> = {
        [`${dir}/test.ts`]: code,
        [`${dir}/tsconfig.json`]: JSON.stringify({
          compilerOptions: {
            target: 'esnext',
            module: 'esnext',
            moduleResolution: 'bundler',
            baseUrl: projectRoot,
            paths: {
              gazania: ['src/index.ts'],
            },
          },
          files: ['test.ts'],
        }),
      }
      return files
    }

    async function getTypeChecker(
      dir: string,
      code: string,
    ): Promise<{ program: ts.Program, checker: ts.TypeChecker, sourceFile: ts.SourceFile }> {
      const tsInstance = await loadTS()
      const files = setupFixture(dir, code)
      const system = createTestingSystem(files, tsInstance)
      const parsed = parseTSConfig(tsInstance, `${dir}/tsconfig.json`, system)
      const { program, checker } = createTypeCheckerProgram(tsInstance, parsed, system)
      const sourceFile = program.getSourceFile(`${dir}/test.ts`)!
      return { program, checker, sourceFile }
    }

    describe('collectBuilderNamesByType', () => {
      it('detects direct gazania import', async () => {
        const { program, checker, sourceFile } = await getTypeChecker(
          '/vfs/type-aware',
          `import { gazania } from 'gazania'\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual(['gazania'])
        expect(result.namespace).toBeUndefined()
      })

      it('detects aliased import', async () => {
        const { program, checker, sourceFile } = await getTypeChecker(
          '/vfs/type-aware',
          `import { gazania as g } from 'gazania'\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual(['g'])
      })

      it('detects variable from createGazania()', async () => {
        const { program, checker, sourceFile } = await getTypeChecker(
          '/vfs/type-aware',
          `import { createGazania } from 'gazania'\nconst g = createGazania()\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toContain('g')
      })

      it('detects namespace import', async () => {
        const { program, checker, sourceFile } = await getTypeChecker(
          '/vfs/type-aware',
          `import * as ns from 'gazania'\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.namespace).toBe('ns')
        expect(result.builderNames).toEqual([])
      })

      it('ignores non-gazania variables', async () => {
        const { program, checker, sourceFile } = await getTypeChecker(
          '/vfs/type-aware',
          `const notGazania = { query: () => {} }\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual([])
        expect(result.namespace).toBeUndefined()
      })

      it('ignores non-gazania imports', async () => {
        const { program, checker, sourceFile } = await getTypeChecker(
          '/vfs/type-aware',
          `import { something } from 'other'\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual([])
        expect(result.namespace).toBeUndefined()
      })

      it('detects factory call with aliased import', async () => {
        const { program, checker, sourceFile } = await getTypeChecker(
          '/vfs/type-aware',
          `import { createGazania as init } from 'gazania'\nconst g = init()\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toContain('g')
      })

      it('only detects gazania names from mixed imports', async () => {
        const { program, checker, sourceFile } = await getTypeChecker(
          '/vfs/type-aware',
          `import { gazania, something } from 'gazania'\nimport { other } from 'other-lib'\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual(['gazania'])
        expect(result.namespace).toBeUndefined()
      })

      it('detects re-exported gazania import', async () => {
        const dir = '/vfs/type-aware'
        const tsInstance = await loadTS()
        const system = createTestingSystem({
          [`${dir}/utils.ts`]: `export { gazania } from 'gazania'\n`,
          [`${dir}/test.ts`]: `import { gazania } from './utils'\n`,
          [`${dir}/tsconfig.json`]: JSON.stringify({
            compilerOptions: {
              target: 'esnext',
              module: 'esnext',
              moduleResolution: 'bundler',
              baseUrl: projectRoot,
              paths: {
                gazania: ['src/index.ts'],
              },
            },
            files: ['test.ts', 'utils.ts'],
          }),
        }, tsInstance)

        const parsed = parseTSConfig(tsInstance, `${dir}/tsconfig.json`, system)
        const { program, checker } = createTypeCheckerProgram(tsInstance, parsed, system)
        const sourceFile = program.getSourceFile(`${dir}/test.ts`)!
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual(['gazania'])
      })
    })

    describe('collectBuilderNamesForFile', () => {
      it('returns empty for missing file', async () => {
        const tsInstance = await loadTS()
        const system = createTestingSystem({
          '/vfs/tsconfig.json': JSON.stringify({
            compilerOptions: { target: 'esnext', module: 'esnext', moduleResolution: 'bundler', strict: true },
            files: ['/vfs/a.ts'],
          }),
          '/vfs/a.ts': 'export const x = 1',
        }, tsInstance)
        const parsed = parseTSConfig(tsInstance, '/vfs/tsconfig.json', system)
        const { program, checker } = createTypeCheckerProgram(tsInstance, parsed, system)
        const result = collectBuilderNamesForFile(ts, program, checker, '/nonexistent/file.ts')
        expect(result.builderNames).toEqual([])
        expect(result.namespace).toBeUndefined()
      })
    })
  })
}
