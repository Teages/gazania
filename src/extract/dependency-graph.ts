import type { Node, Program } from 'estree'
import type { ModuleResolver } from './ts-program'
import { walkAST } from './walk'

const GAZANIA_SPECIFIERS = new Set(['gazania'])

export interface FileImport {
  /** Local variable name in the importing file */
  localName: string
  /** Exported name from the source module */
  importedName: string
  /** Original import specifier (e.g., '../fragments/user') */
  sourceModule: string
  /** Resolved absolute path of the source file */
  resolvedPath: string
}

/**
 * Extract non-gazania imports from an AST and resolve them to absolute file paths.
 * Only imports that resolve to files within the `knownFiles` set are returned.
 */
export function getFileImports(
  ast: Program,
  filePath: string,
  resolver: ModuleResolver,
  knownFiles: Set<string>,
): FileImport[] {
  const imports: FileImport[] = []

  walkAST(ast, (node: Node) => {
    if (node.type !== 'ImportDeclaration') {
      return
    }

    const source = String(node.source.value)

    // Skip gazania imports (handled internally by the evaluate engine)
    if (GAZANIA_SPECIFIERS.has(source)) {
      return
    }

    const resolved = resolver.resolve(source, filePath)
    if (!resolved || !knownFiles.has(resolved)) {
      return
    }

    for (const spec of node.specifiers) {
      if (spec.type === 'ImportSpecifier') {
        const importedName = spec.imported.type === 'Identifier'
          ? spec.imported.name
          : String(spec.imported.value)
        imports.push({
          localName: spec.local.name,
          importedName,
          sourceModule: source,
          resolvedPath: resolved,
        })
      }
      else if (spec.type === 'ImportDefaultSpecifier') {
        imports.push({
          localName: spec.local.name,
          importedName: 'default',
          sourceModule: source,
          resolvedPath: resolved,
        })
      }
    }
  })

  return imports
}

/**
 * Topological sort of files based on their dependency graph.
 * Files with no dependencies come first (leaves), consumers come later.
 * Circular dependencies are handled gracefully by skipping already-visiting nodes.
 *
 * @param deps - Map of filePath -> set of file paths it depends on
 * @param allFiles - All files to include in the result
 * @returns Files in dependency order (dependencies first)
 */
export function topologicalSort(
  deps: Map<string, Set<string>>,
  allFiles: string[],
): string[] {
  const result: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(file: string): void {
    if (visited.has(file)) {
      return
    }
    if (visiting.has(file)) {
      return // circular dependency — break the cycle
    }

    visiting.add(file)

    const children = deps.get(file)
    if (children) {
      for (const child of children) {
        visit(child)
      }
    }

    visiting.delete(file)
    visited.add(file)
    result.push(file)
  }

  for (const file of allFiles) {
    visit(file)
  }

  return result
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('topologicalSort', () => {
    it('returns files with no dependencies in original order', () => {
      const deps = new Map<string, Set<string>>()
      deps.set('a.ts', new Set())
      deps.set('b.ts', new Set())
      deps.set('c.ts', new Set())

      const result = topologicalSort(deps, ['a.ts', 'b.ts', 'c.ts'])
      expect(result).toEqual(['a.ts', 'b.ts', 'c.ts'])
    })

    it('puts dependencies before dependents', () => {
      const deps = new Map<string, Set<string>>()
      deps.set('query.ts', new Set(['partial.ts']))
      deps.set('partial.ts', new Set())

      const result = topologicalSort(deps, ['query.ts', 'partial.ts'])
      expect(result.indexOf('partial.ts')).toBeLessThan(result.indexOf('query.ts'))
    })

    it('handles multi-level dependencies', () => {
      const deps = new Map<string, Set<string>>()
      deps.set('query.ts', new Set(['partialB.ts']))
      deps.set('partialB.ts', new Set(['partialA.ts']))
      deps.set('partialA.ts', new Set())

      const result = topologicalSort(deps, ['query.ts', 'partialB.ts', 'partialA.ts'])
      expect(result.indexOf('partialA.ts')).toBeLessThan(result.indexOf('partialB.ts'))
      expect(result.indexOf('partialB.ts')).toBeLessThan(result.indexOf('query.ts'))
    })

    it('handles circular dependencies without infinite loop', () => {
      const deps = new Map<string, Set<string>>()
      deps.set('a.ts', new Set(['b.ts']))
      deps.set('b.ts', new Set(['a.ts']))

      const result = topologicalSort(deps, ['a.ts', 'b.ts'])
      expect(result).toHaveLength(2)
      expect(result).toContain('a.ts')
      expect(result).toContain('b.ts')
    })

    it('includes files not present in deps map', () => {
      const deps = new Map<string, Set<string>>()
      const result = topologicalSort(deps, ['standalone.ts'])
      expect(result).toEqual(['standalone.ts'])
    })
  })
}
