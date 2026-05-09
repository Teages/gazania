import type { Node, Program } from 'estree'
import type { StaticBuilderChain, StaticDirectiveDef } from './types'
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
 * Check if a node represents a terminal `.select(...)` call from a gazania
 * builder chain. The final method must be `.select(...)`.
 */
export function isGazaniaSelectCall(
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

  return isGazaniaChainRoot(callee.object, builderNames, namespace)
}

/**
 * Check if the expression originates from a gazania builder root.
 * Traverses member access and call expressions up the chain.
 */
export function isGazaniaChainRoot(
  node: Node,
  builderNames: string[],
  namespace: string | undefined,
): boolean {
  if (node.type === 'Identifier') {
    return builderNames.includes(node.name)
  }

  if (node.type === 'MemberExpression') {
    if (node.object.type === 'Identifier' && namespace && node.object.name === namespace) {
      return true
    }
    return isGazaniaChainRoot(node.object, builderNames, namespace)
  }

  if (node.type === 'CallExpression') {
    const { callee } = node
    if (callee.type === 'Identifier' && builderNames.includes(callee.name)) {
      return true
    }
    if (callee.type === 'MemberExpression') {
      return isGazaniaChainRoot(callee.object, builderNames, namespace)
    }
  }

  return false
}

function extractVarDefs(node: Node): Record<string, string> | undefined {
  if (node.type !== 'ObjectExpression' || node.properties.length === 0) {
    return undefined
  }

  const defs: Record<string, string> = {}
  let hasAny = false

  for (const prop of node.properties) {
    if (
      prop.type === 'Property'
      && prop.key.type === 'Identifier'
      && prop.value.type === 'Literal'
      && typeof prop.value.value === 'string'
    ) {
      defs[prop.key.name] = prop.value.value
      hasAny = true
    }
  }

  return hasAny ? defs : undefined
}

function extractDirectiveDef(node: Node): StaticDirectiveDef | undefined {
  if (
    node.type !== 'ArrowFunctionExpression'
    && node.type !== 'FunctionExpression'
  ) {
    return undefined
  }

  const params = node.params
  return {
    callback: node,
    hasVarsParam: params.length > 0,
  }
}

/**
 * Walk a confirmed `.select()` CallExpression UP the callee chain,
 * extracting metadata for each builder method encountered.
 *
 * Recognized methods:
 * - .query(name) / .mutation(name) / .subscription(name) → type + name
 * - .fragment(name) → type='fragment' + name
 * - .partial(name) / .section(name) → type + name
 * - .on(typeName) → typeName
 * - .vars(defs) → Record<string, string>
 * - .directives(fn) → StaticDirectiveDef
 * - .select(callback) → callback AST + param names
 *
 * Returns `StaticBuilderChain | null` (null if the chain cannot be analyzed).
 */
export function analyzeBuilderChain(
  node: Node,
  builderNames: string[],
  namespace: string | undefined,
): StaticBuilderChain | null {
  if (node.type !== 'CallExpression') {
    return null
  }

  const { callee } = node
  if (
    callee.type !== 'MemberExpression'
    || callee.property.type !== 'Identifier'
    || callee.property.name !== 'select'
  ) {
    return null
  }

  if (!isGazaniaChainRoot(callee.object, builderNames, namespace)) {
    return null
  }

  const selectArg = node.arguments[0]
  if (!selectArg) {
    return null
  }

  let selectCallback: Node
  let callbackParams: { dollar: string, vars?: string }

  if (
    selectArg.type === 'ArrowFunctionExpression'
    || selectArg.type === 'FunctionExpression'
  ) {
    selectCallback = selectArg
    const paramNames = selectArg.params
      .filter((p): p is Extract<typeof p, { type: 'Identifier' }> => p.type === 'Identifier')
      .map(p => p.name)
    callbackParams = {
      dollar: paramNames[0] ?? '$',
      vars: paramNames[1],
    }
  }
  else {
    return null
  }

  let type: StaticBuilderChain['type'] | undefined
  let name: string | undefined
  let typeName: string | undefined
  let variableDefs: Record<string, string> | undefined
  const directives: StaticDirectiveDef[] = []

  let current: Node = callee.object

  while (current) {
    if (current.type === 'CallExpression') {
      const callCallee: Node = current.callee

      if (callCallee.type === 'MemberExpression' && callCallee.property.type === 'Identifier') {
        const methodName = callCallee.property.name

        switch (methodName) {
          case 'query':
          case 'mutation':
          case 'subscription':
          case 'fragment':
          case 'partial':
          case 'section': {
            if (!type) {
              type = methodName
              const arg = current.arguments[0]
              if (arg && arg.type === 'Literal' && typeof arg.value === 'string') {
                name = arg.value
              }
            }
            current = callCallee.object
            continue
          }
          case 'on': {
            const arg = current.arguments[0]
            if (arg && arg.type === 'Literal' && typeof arg.value === 'string') {
              typeName = arg.value
            }
            current = callCallee.object
            continue
          }
          case 'vars': {
            const arg = current.arguments[0]
            if (arg) {
              const defs = extractVarDefs(arg)
              if (defs) {
                variableDefs = defs
              }
            }
            current = callCallee.object
            continue
          }
          case 'directives': {
            const arg = current.arguments[0]
            if (arg) {
              const def = extractDirectiveDef(arg)
              if (def) {
                directives.push(def)
              }
            }
            current = callCallee.object
            continue
          }
          default: {
            current = callCallee.object
            continue
          }
        }
      }
      else if (callCallee.type === 'Identifier' && builderNames.includes(callCallee.name)) {
        break
      }
      else if (callCallee.type === 'Identifier') {
        break
      }
    }
    else if (current.type === 'Identifier') {
      break
    }
    else if (current.type === 'MemberExpression') {
      if (
        current.object.type === 'Identifier'
        && namespace
        && current.object.name === namespace
      ) {
        break
      }
      current = current.object
      continue
    }

    break
  }

  if (!type) {
    return null
  }

  return {
    type,
    name: name ?? '',
    typeName,
    variableDefs,
    directives: directives.length > 0 ? directives : undefined,
    selectCallback,
    callbackParams,
    loc: {
      start: (node as any).start ?? 0,
      end: (node as any).end ?? 0,
    },
  }
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
