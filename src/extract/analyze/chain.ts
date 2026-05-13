import type { Node } from 'estree'
import type { StaticBuilderChain, StaticDirectiveDef } from './types'

export interface TypeContext {
  checker: import('typescript').TypeChecker
  nodeMap?: WeakMap<any, import('typescript').Node>
  builderNames: string[]
  namespace: string | undefined
}

export function resolvePartialFragmentName(
  checker: import('typescript').TypeChecker,
  tsNode: import('typescript').Node,
): string | null {
  const type = checker.getTypeAtLocation(tsNode)

  const nameProp = checker.getPropertyOfType(type, ' $fragmentName')
  if (!nameProp) {
    return null
  }

  let nameType = checker.getTypeOfSymbol(nameProp)
  nameType = unwrapOptional(checker, nameType)
  if (nameType.isStringLiteral()) {
    return nameType.value
  }

  return null
}

const NULLABLE_FLAGS = 4 | 8 // TypeFlags.Undefined | TypeFlags.Null

function unwrapOptional(
  checker: import('typescript').TypeChecker,
  type: import('typescript').Type,
): import('typescript').Type {
  if (!type.isUnion()) {
    return type
  }
  const nonNullable = type.types.find((t: any) => !(t.flags & NULLABLE_FLAGS))
  return nonNullable ?? type
}

function hasGazaniaMarker(
  checker: import('typescript').TypeChecker,
  type: import('typescript').Type,
): boolean {
  return !!checker.getPropertyOfType(type, '~isGazania')
}

function isGazaniaNode(
  node: Node,
  ctx: TypeContext,
): boolean {
  if (!ctx.nodeMap) {
    return false
  }
  const tsNode = ctx.nodeMap.get(node)
  if (!tsNode) {
    return false
  }
  const type = ctx.checker.getTypeAtLocation(tsNode)
  return hasGazaniaMarker(ctx.checker, type)
}

export function isGazaniaSelectCall(
  node: Node,
  builderNames: string[],
  namespace: string | undefined,
  typeCtx?: TypeContext,
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

  return isGazaniaChainRoot(callee.object, builderNames, namespace, typeCtx)
}

export function isGazaniaChainRoot(
  node: Node,
  builderNames: string[],
  namespace: string | undefined,
  typeCtx?: TypeContext,
): boolean {
  if (typeCtx && isGazaniaNode(node, typeCtx)) {
    return true
  }

  if (node.type === 'Identifier') {
    return builderNames.includes(node.name)
  }

  if (node.type === 'MemberExpression') {
    if (node.object.type === 'Identifier' && namespace && node.object.name === namespace) {
      return true
    }
    return isGazaniaChainRoot(node.object, builderNames, namespace, typeCtx)
  }

  if (node.type === 'CallExpression') {
    const { callee } = node
    if (callee.type === 'Identifier' && builderNames.includes(callee.name)) {
      return true
    }
    if (callee.type === 'MemberExpression') {
      return isGazaniaChainRoot(callee.object, builderNames, namespace, typeCtx)
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
  typeCtx?: TypeContext,
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

  if (!isGazaniaChainRoot(callee.object, builderNames, namespace, typeCtx)) {
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
      else if (callCallee.type === 'Identifier' && (builderNames.includes(callCallee.name) || (typeCtx && isGazaniaNode(callCallee, typeCtx)))) {
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
      if (typeCtx && isGazaniaNode(current, typeCtx)) {
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
      start: node.range?.[0] ?? 0,
      end: node.range?.[1] ?? 0,
    },
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  async function parseCode(code: string) {
    const { parse } = await import('@typescript-eslint/typescript-estree')
    return parse(code, { range: true }) as any
  }

  async function getExpression(code: string) {
    const ast = await parseCode(code)
    return ast.body[0].expression
  }

  async function _getLastExpression(code: string) {
    const ast = await parseCode(code)
    const last = ast.body[ast.body.length - 1]
    return last.type === 'ExpressionStatement' ? last.expression : last.declarations?.[0]?.init
  }

  describe('analyzeBuilderChain', () => {
    it('extracts metadata from simple query chain', async () => {
      const expr = await getExpression(
        `gazania.query('TestQuery').select($ => $.select(['id', 'name']))`,
      )
      const result = analyzeBuilderChain(expr, ['gazania'], undefined)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('query')
      expect(result!.name).toBe('TestQuery')
      expect(result!.typeName).toBeUndefined()
      expect(result!.variableDefs).toBeUndefined()
      expect(result!.callbackParams.dollar).toBe('$')
      expect(result!.callbackParams.vars).toBeUndefined()
    })

    it('extracts metadata from mutation chain', async () => {
      const expr = await getExpression(
        `gazania.mutation('CreateUser').select($ => $.select(['id']))`,
      )
      const result = analyzeBuilderChain(expr, ['gazania'], undefined)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('mutation')
      expect(result!.name).toBe('CreateUser')
    })

    it('extracts metadata from subscription chain', async () => {
      const expr = await getExpression(
        `gazania.subscription('OnMessage').select($ => $.select(['id', 'text']))`,
      )
      const result = analyzeBuilderChain(expr, ['gazania'], undefined)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('subscription')
      expect(result!.name).toBe('OnMessage')
    })

    it('extracts metadata from fragment chain with .on()', async () => {
      const expr = await getExpression(
        `gazania.fragment('UserFields').on('User').select($ => $.select(['id', 'name']))`,
      )
      const result = analyzeBuilderChain(expr, ['gazania'], undefined)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('fragment')
      expect(result!.name).toBe('UserFields')
      expect(result!.typeName).toBe('User')
    })

    it('extracts metadata from partial chain', async () => {
      const expr = await getExpression(
        `gazania.partial('UserFields').on('User').select($ => $.select(['id']))`,
      )
      const result = analyzeBuilderChain(expr, ['gazania'], undefined)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('partial')
      expect(result!.name).toBe('UserFields')
      expect(result!.typeName).toBe('User')
    })

    it('extracts metadata from section chain', async () => {
      const expr = await getExpression(
        `gazania.section('UserFields').on('User').select($ => $.select(['id']))`,
      )
      const result = analyzeBuilderChain(expr, ['gazania'], undefined)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('section')
      expect(result!.name).toBe('UserFields')
      expect(result!.typeName).toBe('User')
    })

    it('extracts variable definitions from .vars()', async () => {
      const expr = await getExpression(
        `gazania.query('FetchUser').vars({ id: 'ID!', name: 'String' }).select(($, vars) => $.select(['id']))`,
      )
      const result = analyzeBuilderChain(expr, ['gazania'], undefined)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('query')
      expect(result!.name).toBe('FetchUser')
      expect(result!.variableDefs).toEqual({ id: 'ID!', name: 'String' })
      expect(result!.callbackParams.dollar).toBe('$')
      expect(result!.callbackParams.vars).toBe('vars')
    })

    it('extracts directive definitions from .directives()', async () => {
      const expr = await getExpression(
        `gazania.query('CachedQuery').directives(() => [['@cache', { maxAge: 60 }]]).select($ => $.select(['data']))`,
      )
      const result = analyzeBuilderChain(expr, ['gazania'], undefined)

      expect(result).not.toBeNull()
      expect(result!.directives).toHaveLength(1)
      expect(result!.directives![0].hasVarsParam).toBe(false)
      expect(result!.directives![0].callback.type).toBe('ArrowFunctionExpression')
    })

    it('extracts directives with vars parameter', async () => {
      const expr = await getExpression(
        `gazania.query('Test').directives((vars) => [['@cache', { maxAge: 60 }]]).select($ => $.select(['id']))`,
      )
      const result = analyzeBuilderChain(expr, ['gazania'], undefined)

      expect(result).not.toBeNull()
      expect(result!.directives).toHaveLength(1)
      expect(result!.directives![0].hasVarsParam).toBe(true)
    })

    it('returns null for non-CallExpression', () => {
      expect(analyzeBuilderChain({ type: 'Identifier', name: 'x' } as any, ['gazania'], undefined)).toBeNull()
    })

    it('returns null for non-.select() call', async () => {
      const expr = await getExpression(`gazania.query('Test')`)
      expect(analyzeBuilderChain(expr, ['gazania'], undefined)).toBeNull()
    })

    it('returns null for select call not on gazania chain', async () => {
      const expr = await getExpression(`something.select($ => $.select(['id']))`)
      expect(analyzeBuilderChain(expr, ['gazania'], undefined)).toBeNull()
    })

    it('returns null when select has no arguments', async () => {
      const expr = await getExpression(`gazania.query('Test').select()`)
      expect(analyzeBuilderChain(expr, ['gazania'], undefined)).toBeNull()
    })

    it('works with createGazania builder via builderNames', async () => {
      const code = `const doc = createGazania().query('MyQuery').select($ => $.select(['id']))`
      const ast = await parseCode(code)
      const init = ast.body[0].declarations[0].init
      const result = analyzeBuilderChain(init, ['createGazania'], undefined)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('query')
      expect(result!.name).toBe('MyQuery')
    })

    it('preserves source location', async () => {
      const expr = await getExpression(
        `gazania.query('Test').select($ => $.select(['id']))`,
      )
      const result = analyzeBuilderChain(expr, ['gazania'], undefined)

      expect(result).not.toBeNull()
      expect(typeof result!.loc.start).toBe('number')
      expect(typeof result!.loc.end).toBe('number')
      expect(result!.loc.start).toBeLessThan(result!.loc.end)
    })
  })

  describe('isGazaniaSelectCall', () => {
    it('identifies gazania select call', async () => {
      const expr = await getExpression(
        `gazania.query('Test').select($ => $.select(['id']))`,
      )
      expect(isGazaniaSelectCall(expr, ['gazania'], undefined)).toBe(true)
    })

    it('rejects non-select call', async () => {
      const expr = await getExpression(`gazania.query('Test')`)
      expect(isGazaniaSelectCall(expr, ['gazania'], undefined)).toBe(false)
    })

    it('rejects non-CallExpression', () => {
      expect(isGazaniaSelectCall({ type: 'Identifier', name: 'x' } as any, ['gazania'], undefined)).toBe(false)
    })

    it('rejects select call on non-gazania chain', async () => {
      const expr = await getExpression(`something.select($ => $.select(['id']))`)
      expect(isGazaniaSelectCall(expr, ['gazania'], undefined)).toBe(false)
    })

    it('recognizes namespace-based select call', async () => {
      const expr = await getExpression(
        `g.gazania.query('Test').select($ => $.select(['id']))`,
      )
      expect(isGazaniaSelectCall(expr, [], 'g')).toBe(true)
    })
  })

  describe('isGazaniaChainRoot', () => {
    it('recognizes direct builder identifier', () => {
      const node = { type: 'Identifier', name: 'gazania' } as any
      expect(isGazaniaChainRoot(node, ['gazania'], undefined)).toBe(true)
    })

    it('rejects unknown identifier', () => {
      const node = { type: 'Identifier', name: 'other' } as any
      expect(isGazaniaChainRoot(node, ['gazania'], undefined)).toBe(false)
    })

    it('recognizes namespace member access', async () => {
      const node = await getExpression(`g.query`)
      expect(isGazaniaChainRoot(node, [], 'g')).toBe(true)
    })

    it('recognizes chained call expression', async () => {
      const node = await getExpression(`gazania.query('Test')`)
      expect(isGazaniaChainRoot(node, ['gazania'], undefined)).toBe(true)
    })

    it('recognizes createGazania() direct call', async () => {
      const node = await getExpression(`createGazania()`)
      expect(isGazaniaChainRoot(node, ['createGazania'], undefined)).toBe(true)
    })
  })
}
