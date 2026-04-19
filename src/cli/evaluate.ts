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

      // Capture simple literal declarations (string, number, boolean, null)
      // so variables like `const API = 'https://...'` are available
      // when evaluating e.g. `createGazania(API)`.
      if (decl.init.type === 'Literal') {
        context[decl.id.name] = decl.init.value
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

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  async function parseCode(code: string) {
    const acorn = await import('acorn')
    return acorn.parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
    }) as any
  }

  describe('evaluateGazaniaExpressions', () => {
    it('returns empty array when no gazania imports exist', async () => {
      const code = `const x = 1`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)
      expect(results).toEqual([])
    })

    it('returns empty array when gazania is imported but no select calls', async () => {
      const code = `import { gazania } from 'gazania'\nconst q = gazania.query('Test')`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)
      expect(results).toEqual([])
    })

    it('transforms a simple gazania query', async () => {
      const code = `import { gazania } from 'gazania'
const doc = gazania.query('TestQuery')
  .select($ => $.select(['id', 'name']))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(1)
      const result = results[0]!
      const parsed = JSON.parse(result.replacement)
      expect(parsed.kind).toBe('Document')
      expect(parsed.definitions).toHaveLength(1)
      expect(parsed.definitions[0].kind).toBe('OperationDefinition')
      expect(parsed.definitions[0].operation).toBe('query')
      expect(parsed.definitions[0].name.value).toBe('TestQuery')
    })

    it('transforms a query with variables', async () => {
      const code = `import { gazania } from 'gazania'
const doc = gazania.query('FetchUser')
  .vars({ id: 'ID!' })
  .select(($, vars) => $.select([{
    user: $ => $.args({ id: vars.id }).select(['id', 'name']),
  }]))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(1)
      const parsed = JSON.parse(results[0]!.replacement)
      expect(parsed.kind).toBe('Document')
      expect(parsed.definitions[0].variableDefinitions).toHaveLength(1)
    })

    it('transforms a mutation', async () => {
      const code = `import { gazania } from 'gazania'
const doc = gazania.mutation('CreateUser')
  .vars({ input: 'CreateUserInput!' })
  .select(($, vars) => $.select([{
    createUser: $ => $.args({ input: vars.input }).select(['id', 'name']),
  }]))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(1)
      const parsed = JSON.parse(results[0]!.replacement)
      expect(parsed.definitions[0].operation).toBe('mutation')
    })

    it('transforms a subscription', async () => {
      const code = `import { gazania } from 'gazania'
const doc = gazania.subscription('OnMessage')
  .select($ => $.select(['id', 'text']))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(1)
      const parsed = JSON.parse(results[0]!.replacement)
      expect(parsed.definitions[0].operation).toBe('subscription')
    })

    it('transforms a fragment', async () => {
      const code = `import { gazania } from 'gazania'
const doc = gazania.fragment('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(1)
      const parsed = JSON.parse(results[0]!.replacement)
      expect(parsed.definitions[0].kind).toBe('FragmentDefinition')
    })

    it('handles createGazania usage', async () => {
      const code = `import { createGazania } from 'gazania'
const schema = createGazania()
const doc = schema.query('MyQuery')
  .select($ => $.select(['id']))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(1)
      const parsed = JSON.parse(results[0]!.replacement)
      expect(parsed.kind).toBe('Document')
    })

    it('handles enum values in args', async () => {
      const code = `import { gazania } from 'gazania'
const doc = gazania.query('FetchAnime')
  .select($ => $.select([{
    Media: $ => $.args({ type: $.enum('ANIME') }).select(['id']),
  }]))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(1)
      const parsed = JSON.parse(results[0]!.replacement)
      expect(parsed.kind).toBe('Document')
    })

    it('transforms multiple queries in the same file', async () => {
      const code = `import { gazania } from 'gazania'
const doc1 = gazania.query('Query1')
  .select($ => $.select(['id']))
const doc2 = gazania.query('Query2')
  .select($ => $.select(['name']))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(2)
    })

    it('silently skips expressions with external variables', async () => {
      const code = `import { gazania } from 'gazania'
const myField = getFieldName()
const doc = gazania.query('Test')
  .select($ => $.select([myField]))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(0)
    })

    it('handles directives', async () => {
      const code = `import { gazania } from 'gazania'
const doc = gazania.query('CachedQuery')
  .directives(() => [['@cache', { maxAge: 60 }]])
  .select($ => $.select(['data']))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(1)
      const parsed = JSON.parse(results[0]!.replacement)
      expect(parsed.definitions[0].directives).toHaveLength(1)
    })

    it('provides correct start/end positions', async () => {
      const code = `import { gazania } from 'gazania'
const doc = gazania.query('Test').select($ => $.select(['id']))`
      const ast = await parseCode(code)
      const results = evaluateGazaniaExpressions(code, ast)

      expect(results).toHaveLength(1)
      const { start, end } = results[0]!

      const original = code.slice(start, end)
      expect(original).toContain('gazania.query')
      expect(original).toContain('.select(')
    })
  })
}
