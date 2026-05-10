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
  const { describe, it, expect, beforeEach, afterEach } = import.meta.vitest

  describe('type-aware-ids', async () => {
    const ts = await import('typescript').then(m => ('default' in m ? m.default : m) as typeof import('typescript'))
    const { createTypeCheckerProgram, loadTS, parseTSConfig } = await import('../ts-program')
    const { mkdir, rm, writeFile } = await import('node:fs/promises')
    const { randomUUID } = await import('node:crypto')
    const { tmpdir } = await import('node:os')
    const { join, resolve } = await import('node:path')
    const { cwd } = await import('node:process')

    const projectRoot = resolve(cwd())

    async function setupFixture(
      dir: string,
      code: string,
    ): Promise<{ program: ts.Program, checker: ts.TypeChecker, sourceFile: ts.SourceFile }> {
      await writeFile(join(dir, 'test.ts'), code)
      await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
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
      }))

      const tsInstance = await loadTS()
      const parsed = parseTSConfig(tsInstance, join(dir, 'tsconfig.json'), tsInstance.sys)
      const { program, checker } = createTypeCheckerProgram(tsInstance, parsed, tsInstance.sys)
      const sourceFile = program.getSourceFile(join(dir, 'test.ts'))!
      return { program, checker, sourceFile }
    }

    describe('collectBuilderNamesByType', () => {
      let dir: string

      beforeEach(async () => {
        dir = join(tmpdir(), `gazania-type-aware-test-${randomUUID()}`)
        await mkdir(dir, { recursive: true })
      })

      afterEach(async () => {
        await rm(dir, { recursive: true, force: true })
      })

      it('detects direct gazania import', async () => {
        const { program, checker, sourceFile } = await setupFixture(
          dir,
          `import { gazania } from 'gazania'\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual(['gazania'])
        expect(result.namespace).toBeUndefined()
      })

      it('detects aliased import', async () => {
        const { program, checker, sourceFile } = await setupFixture(
          dir,
          `import { gazania as g } from 'gazania'\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual(['g'])
      })

      it('detects variable from createGazania()', async () => {
        const { program, checker, sourceFile } = await setupFixture(
          dir,
          `import { createGazania } from 'gazania'\nconst g = createGazania()\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toContain('g')
      })

      it('detects namespace import', async () => {
        const { program, checker, sourceFile } = await setupFixture(
          dir,
          `import * as ns from 'gazania'\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.namespace).toBe('ns')
        expect(result.builderNames).toEqual([])
      })

      it('ignores non-gazania variables', async () => {
        const { program, checker, sourceFile } = await setupFixture(
          dir,
          `const notGazania = { query: () => {} }\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual([])
        expect(result.namespace).toBeUndefined()
      })

      it('ignores non-gazania imports', async () => {
        const { program, checker, sourceFile } = await setupFixture(
          dir,
          `import { something } from 'other'\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual([])
        expect(result.namespace).toBeUndefined()
      })

      it('detects factory call with aliased import', async () => {
        const { program, checker, sourceFile } = await setupFixture(
          dir,
          `import { createGazania as init } from 'gazania'\nconst g = init()\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toContain('g')
      })

      it('only detects gazania names from mixed imports', async () => {
        const { program, checker, sourceFile } = await setupFixture(
          dir,
          `import { gazania, something } from 'gazania'\nimport { other } from 'other-lib'\n`,
        )
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual(['gazania'])
        expect(result.namespace).toBeUndefined()
      })

      it('detects re-exported gazania import', async () => {
        await writeFile(join(dir, 'utils.ts'), `export { gazania } from 'gazania'\n`)
        await writeFile(join(dir, 'test.ts'), `import { gazania } from './utils'\n`)
        await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
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
        }))

        const tsInstance = await loadTS()
        const parsed = parseTSConfig(tsInstance, join(dir, 'tsconfig.json'), tsInstance.sys)
        const { program, checker } = createTypeCheckerProgram(tsInstance, parsed, tsInstance.sys)
        const sourceFile = program.getSourceFile(join(dir, 'test.ts'))!
        const result = collectBuilderNamesByType(ts, program, checker, sourceFile)
        expect(result.builderNames).toEqual(['gazania'])
      })
    })

    describe('collectBuilderNamesForFile', () => {
      it('returns empty for missing file', { timeout: 30_000 }, async () => {
        const tsInstance = await loadTS()
        const parsed = parseTSConfig(tsInstance, 'tsconfig.node.json', tsInstance.sys)
        const { program, checker } = createTypeCheckerProgram(tsInstance, parsed, tsInstance.sys)
        const result = collectBuilderNamesForFile(ts, program, checker, '/nonexistent/file.ts')
        expect(result.builderNames).toEqual([])
        expect(result.namespace).toBeUndefined()
      })
    })
  })
}
