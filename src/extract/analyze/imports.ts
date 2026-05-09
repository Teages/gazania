import type { Node, Program } from 'estree'
import { walkAST } from '../walk'

const GAZANIA_SPECIFIERS = new Set(['gazania'])

/**
 * Detect gazania imports in the AST and build a name map.
 * Pure AST walking — no VM, no runtime evaluation.
 *
 * Returns the names of imported identifiers that correspond to builder-producing
 * functions (e.g. `gazania`, `createGazania`), any namespace import name,
 * and whether any relevant gazania import was found.
 */
export function collectImports(
  ast: Program,
  contextMap: Record<string, unknown>,
): { builderNames: string[], namespace: string | undefined, hasRelevantImport: boolean } {
  const builderNames: string[] = []
  let namespace: string | undefined
  let hasRelevantImport = false

  walkAST(ast, (node: Node) => {
    if (node.type !== 'ImportDeclaration') {
      return
    }

    if (typeof node.source.value !== 'string' || !GAZANIA_SPECIFIERS.has(node.source.value)) {
      return
    }

    hasRelevantImport = true

    for (const spec of node.specifiers) {
      if (spec.type === 'ImportNamespaceSpecifier') {
        namespace = spec.local.name
        contextMap[spec.local.name] = true
      }
      else if (spec.type === 'ImportSpecifier') {
        const importedName = spec.imported.type === 'Identifier'
          ? spec.imported.name
          : String(spec.imported.value)
        contextMap[spec.local.name] = true
        if (importedName === 'createGazania' || importedName === 'gazania') {
          builderNames.push(spec.local.name)
        }
      }
      else if (spec.type === 'ImportDefaultSpecifier') {
        contextMap[spec.local.name] = true
      }
    }
  })

  return { builderNames, namespace, hasRelevantImport }
}

/**
 * Collect exported names from the AST.
 * Maps exportedName → localVariableName for cross-file resolution.
 */
export function collectExports(ast: Program): Map<string, string> {
  const exports = new Map<string, string>()

  for (const node of ast.body) {
    if (node.type !== 'ExportNamedDeclaration') {
      continue
    }

    if (node.declaration?.type === 'VariableDeclaration') {
      for (const decl of node.declaration.declarations) {
        if (decl.id.type === 'Identifier') {
          exports.set(decl.id.name, decl.id.name)
        }
      }
    }
    else if (
      node.declaration?.type === 'FunctionDeclaration'
      && node.declaration.id
    ) {
      exports.set(node.declaration.id.name, node.declaration.id.name)
    }

    if (node.specifiers) {
      for (const spec of node.specifiers) {
        if (spec.type === 'ExportSpecifier') {
          const localName = spec.local.type === 'Identifier'
            ? spec.local.name
            : String(spec.local.value)
          const exportedName = spec.exported.type === 'Identifier'
            ? spec.exported.name
            : String(spec.exported.value)
          exports.set(exportedName, localName)
        }
      }
    }
  }

  return exports
}

/**
 * Walk VariableDeclarations to find simple literal values.
 * Captures: const x = 'string', const x = 42, const x = true, const x = null
 * Returns a Map of variable name → literal value.
 */
export function collectLiteralVariables(ast: Program): Map<string, unknown> {
  const literals = new Map<string, unknown>()

  walkAST(ast, (node: Node) => {
    if (node.type !== 'VariableDeclaration') {
      return
    }

    for (const decl of node.declarations) {
      if (decl.id.type !== 'Identifier' || !decl.init) {
        continue
      }

      if (decl.init.type === 'Literal') {
        literals.set(decl.id.name, decl.init.value)
      }
    }
  })

  return literals
}
