import type { Node, Program } from 'estree'
import type { Context } from 'node:vm'
import type { NodeWithPosition } from './walk'
import { createContext, runInContext } from 'node:vm'
import * as gazaniaExports from '../index'
import { walkAST } from './walk'

const GAZANIA_SPECIFIERS = new Set(['gazania'])

export interface EvaluateResult {
  /** Start offset in source */
  start: number
  /** End offset in source */
  end: number
  /** The resulting DocumentNode JSON */
  replacement: string
}

/**
 * Detect gazania imports in the AST and build the sandbox context.
 * Returns the names of imported identifiers that correspond to builder-producing
 * functions (e.g. `gazania`, `createGazania`).
 */
function collectImports(
  ast: Program,
  contextMap: Context,
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
        contextMap[spec.local.name] = gazaniaExports
      }
      else if (spec.type === 'ImportSpecifier') {
        const importedName = spec.imported.type === 'Identifier'
          ? spec.imported.name
          : String(spec.imported.value)
        if (importedName in gazaniaExports) {
          contextMap[spec.local.name] = gazaniaExports[importedName as keyof typeof gazaniaExports]
        }
        if (importedName === 'createGazania' || importedName === 'gazania') {
          builderNames.push(spec.local.name)
        }
      }
      else if (spec.type === 'ImportDefaultSpecifier') {
        // default import — unlikely but handle it
        contextMap[spec.local.name] = gazaniaExports
      }
    }
  })

  return { builderNames, namespace, hasRelevantImport }
}

/**
 * Determine if a CallExpression represents a terminal `.select(...)` call
 * from a gazania builder chain. We look for patterns like:
 *
 * - `gazania.query(...).select(...)`
 * - `gazania.query(...).vars(...).select(...)`
 * - `gazania.mutation(...).select(...)`
 * - `gazania.fragment(...).on(...).select(...)`
 * - `createGazania(...).query(...).select(...)`
 *
 * The final method must be `.select(...)`.
 */
function isGazaniaSelectCall(
  node: Node,
  builderNames: string[],
  namespace: string | undefined,
): boolean {
  if (node.type !== 'CallExpression') {
    return false
  }
  const { callee } = node
  if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') {
    return false
  }
  if (callee.property.name !== 'select') {
    return false
  }

  // Walk up the chain to check if the root is a gazania builder
  return isGazaniaChainRoot(callee.object, builderNames, namespace)
}

/**
 * Check if the expression originates from a gazania builder root.
 * Traverses member access and call expressions up the chain.
 */
function isGazaniaChainRoot(
  node: Node,
  builderNames: string[],
  namespace: string | undefined,
): boolean {
  // Direct identifier: `gazania.query(...)` where gazania was imported
  if (node.type === 'Identifier') {
    return builderNames.includes(node.name)
  }

  // Namespace access: `ns.gazania` or just `ns`
  if (node.type === 'MemberExpression') {
    // e.g. `schema.query(...)` where schema = createGazania(...)
    if (node.object.type === 'Identifier' && namespace && node.object.name === namespace) {
      return true
    }
    // Recurse for chained calls like `gazania.query('X').vars({...})`
    return isGazaniaChainRoot(node.object, builderNames, namespace)
  }

  // Call expression in the chain: `createGazania().query(...)` or `gazania.query(...).vars(...)`
  if (node.type === 'CallExpression') {
    const { callee } = node
    // Direct call: `createGazania()`
    if (callee.type === 'Identifier' && builderNames.includes(callee.name)) {
      return true
    }
    // Member call: `.query(...)`, `.vars(...)`, `.on(...)`, `.directives(...)`
    if (callee.type === 'MemberExpression') {
      return isGazaniaChainRoot(callee.object, builderNames, namespace)
    }
  }

  return false
}

/**
 * Pre-evaluate variable declarations that store gazania builder results.
 * For example: `const schema = createGazania()` — we evaluate the RHS
 * and add `schema` to the VM context so later expressions can reference it.
 */
function preEvaluateVariables(
  code: string,
  ast: Program,
  context: Context,
  builderNames: string[],
): void {
  walkAST(ast, (node: Node) => {
    if (node.type !== 'VariableDeclaration') {
      return
    }

    for (const decl of node.declarations) {
      if (
        decl.id.type !== 'Identifier'
        || !decl.init
      ) {
        continue
      }

      // Check if the init is a call to createGazania() or similar
      if (
        decl.init.type === 'CallExpression'
        && decl.init.callee.type === 'Identifier'
        && builderNames.includes(decl.init.callee.name)
      ) {
        const { start, end } = decl.init as NodeWithPosition
        try {
          const value = runInContext(code.slice(start, end), context)
          if (value) {
            context[decl.id.name] = value
            builderNames.push(decl.id.name)
          }
        }
        catch {
          // Skip if evaluation fails
        }
      }
    }
  })
}

/**
 * Evaluate gazania builder expressions in a source code string.
 *
 * @param code - The source code string
 * @param ast - The parsed ESTree AST (with position info)
 * @returns Array of replacements to apply
 */
export function evaluateGazaniaExpressions(
  code: string,
  ast: Program,
): EvaluateResult[] {
  const contextMap: Context = {}
  const { builderNames, namespace, hasRelevantImport } = collectImports(ast, contextMap)

  if (!hasRelevantImport) {
    return []
  }

  const context = createContext(contextMap)

  // Pre-evaluate variable assignments like `const schema = createGazania()`
  preEvaluateVariables(code, ast, context, builderNames)

  const results: EvaluateResult[] = []

  walkAST(ast, (node: Node) => {
    if (!isGazaniaSelectCall(node, builderNames, namespace)) {
      return
    }

    const { start, end } = node as NodeWithPosition

    try {
      const value = runInContext(code.slice(start, end), context)
      // Only replace if the result looks like a DocumentNode
      if (value && typeof value === 'object' && value.kind === 'Document') {
        results.push({
          start,
          end,
          replacement: JSON.stringify(value),
        })
      }
    }
    catch {
      // Silently skip expressions that rely on external context
    }
  })

  return results
}
