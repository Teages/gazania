import type { Node } from 'estree'
import type { ArgumentMap } from '../../runtime/argument'
import type { DirectiveInput } from '../../runtime/directive'
import type { SelectionInput, SelectionObject } from '../../runtime/dollar'
import type { TypeContext } from './chain'
import type { StaticPartialDef, StaticPartialRef, StaticSelectionResult } from './types'
import { Variable } from '../../runtime/variable'
import { resolvePartialFragmentName } from './chain'

/**
 * Interpret a $.select() callback AST to extract selection data statically.
 *
 * Simulates the $ DSL by walking the AST of the callback body, finding
 * the $.select(array) call and interpreting each element of the array
 * to produce the same SelectionInput data that the runtime would generate.
 */
export function interpretSelectCallback(
  callbackNode: Node,
  dollarParam: string,
  varsParam?: string,
  knownPartials?: Map<string, StaticPartialDef>,
  literalScope?: Map<string, unknown>,
  typeCtx?: TypeContext,
): StaticSelectionResult {
  const body = getCallbackBody(callbackNode)
  const selectCall = findSelectCall(body, dollarParam)

  if (!selectCall) {
    return { selection: [], partialRefs: [] }
  }

  const selectionArray = selectCall.arguments[0] as any
  if (!selectionArray || selectionArray.type !== 'ArrayExpression') {
    return { selection: [], partialRefs: [] }
  }

  return interpretSelectionArray(selectionArray, dollarParam, varsParam, knownPartials, literalScope, typeCtx)
}

/**
 * Walk the elements of an ArrayExpression and produce SelectionInput + partial refs.
 */
function interpretSelectionArray(
  arrayNode: any,
  dollarParam: string,
  varsParam?: string,
  knownPartials?: Map<string, StaticPartialDef>,
  literalScope?: Map<string, unknown>,
  typeCtx?: TypeContext,
): StaticSelectionResult {
  const selection: SelectionInput = []
  const partialRefs: StaticPartialRef[] = []

  for (const element of arrayNode.elements ?? []) {
    if (!element) {
      continue
    }

    if (element.type === 'Literal') {
      selection.push(element.value as string)
    }
    else if (element.type === 'ObjectExpression') {
      const obj: SelectionObject = {}

      for (const prop of element.properties) {
        if (prop.type !== 'Property') {
          continue
        }

        const key = getPropertyKey(prop)
        if (key === null) {
          continue
        }

        const value = prop.value

        if (value.type === 'Literal' && value.value === true) {
          obj[key] = true
        }
        else if (
          value.type === 'ArrowFunctionExpression'
          || value.type === 'FunctionExpression'
        ) {
          obj[key] = interpretFieldCallback(value, dollarParam, varsParam, knownPartials, literalScope, typeCtx)
        }
      }

      selection.push(obj)
    }
    else if (element.type === 'SpreadElement') {
      const arg = element.argument
      if (arg.type === 'CallExpression' && arg.callee.type === 'Identifier') {
        let fragmentName: string | null = null

        if (typeCtx?.nodeMap) {
          const tsCallee = typeCtx.nodeMap.get(arg.callee)
          if (tsCallee) {
            fragmentName = resolvePartialFragmentName(typeCtx.checker, tsCallee)
          }
        }

        if (fragmentName) {
          partialRefs.push({
            fragmentName,
            args: arg.arguments[0] ?? { type: 'ObjectExpression', properties: [] },
            loc: { start: arg.range?.[0] ?? 0, end: arg.range?.[1] ?? 0 },
          })
        }
      }
    }
  }

  return { selection, partialRefs }
}

/**
 * Interpret a field callback like `$ => $.args({...}).select([...])`.
 * Returns a function that, when called with a FieldDollar-like object,
 * sets its _args, _selection, and _directives — matching runtime behavior.
 */
function interpretFieldCallback(
  callbackNode: any,
  dollarParam: string,
  varsParam?: string,
  knownPartials?: Map<string, StaticPartialDef>,
  literalScope?: Map<string, unknown>,
  typeCtx?: TypeContext,
): (dollar: any) => any {
  const body = getCallbackBody(callbackNode)
  const innerDollarParam = callbackNode.params?.[0]?.name ?? dollarParam

  let args: ArgumentMap | undefined
  let nestedSelection: StaticSelectionResult | undefined
  let directives: DirectiveInput[] | undefined

  walkMethodChain(body, innerDollarParam, (methodName, callNode) => {
    if (methodName === 'args') {
      const argsObj = callNode.arguments[0]
      if (argsObj?.type === 'ObjectExpression') {
        args = interpretArgsObject(argsObj, innerDollarParam, varsParam, literalScope)
      }
    }
    else if (methodName === 'select') {
      const selArray = callNode.arguments[0]
      if (selArray?.type === 'ArrayExpression') {
        nestedSelection = interpretSelectionArray(selArray, innerDollarParam, varsParam, knownPartials, literalScope, typeCtx)
      }
    }
    else if (methodName === 'directives') {
      directives = interpretDirectives(callNode, innerDollarParam, varsParam, literalScope)
    }
  })

  const fn = (dollar: any): any => {
    if (args) {
      dollar._args = args
    }
    if (nestedSelection) {
      dollar._selection = nestedSelection.selection
    }
    if (directives) {
      dollar._directives = directives
    }
    return dollar
  }

  if (nestedSelection && nestedSelection.partialRefs.length > 0) {
    ;(fn as any)._partialRefs = nestedSelection.partialRefs
  }

  return fn
}

/**
 * Walk a chained method call like $.args({...}).select([...]).directives([...])
 * by traversing the CallExpression callee chain in reverse order.
 */
function walkMethodChain(
  node: any,
  dollarParam: string,
  visitor: (methodName: string, callNode: any) => void,
): void {
  const calls: Array<{ methodName: string, callNode: any }> = []

  let current = node
  while (current?.type === 'CallExpression') {
    if (current.callee?.type === 'MemberExpression'
      && current.callee.object?.type === 'Identifier'
      && current.callee.object.name === dollarParam
      && current.callee.property?.type === 'Identifier') {
      calls.unshift({
        methodName: current.callee.property.name,
        callNode: current,
      })
      break
    }

    if (current.callee?.type === 'MemberExpression'
      && current.callee.property?.type === 'Identifier') {
      calls.unshift({
        methodName: current.callee.property.name,
        callNode: current,
      })
      current = current.callee.object
    }
    else {
      break
    }
  }

  for (const { methodName, callNode } of calls) {
    visitor(methodName, callNode)
  }
}

/**
 * Interpret an ObjectExpression as an ArgumentMap.
 * Resolves literal values, variable references, and enum calls.
 */
export function interpretArgsObject(
  argsNode: any,
  dollarParam: string,
  varsParam?: string,
  literalScope?: Map<string, unknown>,
): ArgumentMap {
  const result: ArgumentMap = {}

  for (const prop of argsNode.properties ?? []) {
    if (prop.type !== 'Property') {
      continue
    }
    const key = getPropertyKey(prop)
    if (key === null) {
      continue
    }
    result[key] = resolveValue(prop.value, dollarParam, varsParam, literalScope)
  }

  return result
}

/**
 * Resolve an AST value node to a runtime-compatible value.
 * Handles: Literal, MemberExpression (vars.x), CallExpression ($.enum('X'))
 */
export function resolveValue(
  valueNode: any,
  dollarParam: string,
  varsParam?: string,
  literalScope?: Map<string, unknown>,
): unknown {
  if (valueNode.type === 'Literal') {
    return valueNode.value
  }

  if (valueNode.type === 'MemberExpression' && !valueNode.computed) {
    const objName = valueNode.object?.name
    const propName = valueNode.property?.name

    if (objName === varsParam && propName) {
      return new Variable(propName)
    }

    if (objName && literalScope?.has(objName) && propName) {
      const scopeVal = literalScope.get(objName)
      if (scopeVal && typeof scopeVal === 'object') {
        return (scopeVal as any)[propName]
      }
    }
  }

  if (valueNode.type === 'CallExpression') {
    if (
      valueNode.callee?.type === 'MemberExpression'
      && valueNode.callee.object?.type === 'Identifier'
      && valueNode.callee.object.name === dollarParam
      && valueNode.callee.property?.name === 'enum'
    ) {
      const enumValue = valueNode.arguments[0]?.value
      if (typeof enumValue === 'string') {
        return () => enumValue
      }
    }
  }

  if (valueNode.type === 'ArrayExpression') {
    return (valueNode.elements ?? []).map(
      (el: any) => resolveValue(el, dollarParam, varsParam, literalScope),
    )
  }

  if (valueNode.type === 'ObjectExpression') {
    const obj: Record<string, unknown> = {}
    for (const prop of valueNode.properties ?? []) {
      if (prop.type !== 'Property') {
        continue
      }
      const key = getPropertyKey(prop)
      if (key !== null) {
        obj[key] = resolveValue(prop.value, dollarParam, varsParam, literalScope)
      }
    }
    return obj
  }

  if (valueNode.type === 'UnaryExpression' && valueNode.operator === '-') {
    const inner = resolveValue(valueNode.argument, dollarParam, varsParam, literalScope)
    if (typeof inner === 'number') {
      return -inner
    }
  }

  if (valueNode.type === 'TemplateLiteral' && (valueNode.quasis?.length ?? 0) === 1 && (valueNode.expressions?.length ?? 0) === 0) {
    return valueNode.quasis[0].value.cooked
  }

  return undefined
}

/**
 * Interpret a $.directives() call to extract DirectiveInput tuples.
 */
function interpretDirectives(
  directivesCall: any,
  dollarParam: string,
  varsParam?: string,
  literalScope?: Map<string, unknown>,
): DirectiveInput[] {
  const result: DirectiveInput[] = []

  for (const arg of directivesCall.arguments ?? []) {
    if (arg.type === 'ArrayExpression' && arg.elements.length >= 2) {
      const nameNode = arg.elements[0]
      const argsNode = arg.elements[1]

      if (nameNode?.type === 'Literal' && typeof nameNode.value === 'string') {
        const directiveName = nameNode.value as `@${string}`
        const directiveArgs = argsNode?.type === 'ObjectExpression'
          ? interpretArgsObject(argsNode, dollarParam, varsParam, literalScope)
          : {}
        result.push([directiveName, directiveArgs])
      }
    }
  }

  return result
}

/**
 * Get the body of a callback function (handles both arrow concise/block bodies).
 */
function getCallbackBody(node: any): any {
  if (node.body?.type === 'BlockStatement') {
    for (const stmt of node.body.body) {
      if (stmt.type === 'ReturnStatement' && stmt.argument) {
        return stmt.argument
      }
    }
    const stmts = node.body.body
    if (stmts.length > 0 && stmts[stmts.length - 1].type === 'ExpressionStatement') {
      return stmts[stmts.length - 1].expression
    }
    return null
  }
  return node.body
}

/**
 * Find the $.select(array) call in a callback body.
 */
function findSelectCall(body: any, dollarParam: string): any {
  if (!body) {
    return null
  }

  if (
    body.type === 'CallExpression'
    && body.callee?.type === 'MemberExpression'
    && body.callee.object?.type === 'Identifier'
    && body.callee.object.name === dollarParam
    && body.callee.property?.name === 'select'
  ) {
    return body
  }

  if (body.type === 'CallExpression') {
    return findSelectCall(body.callee?.object, dollarParam)
  }

  return null
}

/**
 * Get the string key from an ObjectExpression Property.
 * Handles both Identifier keys and Literal (string) keys.
 */
function getPropertyKey(prop: any): string | null {
  if (prop.key?.type === 'Identifier') {
    return prop.key.name
  }
  if (prop.key?.type === 'Literal' && typeof prop.key.value === 'string') {
    return prop.key.value
  }
  return null
}

/**
 * Collect all nested partial refs from selection items (including from field callbacks).
 */
export function collectNestedPartialRefs(selection: SelectionInput): StaticPartialRef[] {
  const refs: StaticPartialRef[] = []

  for (const item of selection) {
    if (typeof item === 'string') {
      continue
    }
    const obj = item as SelectionObject
    for (const value of Object.values(obj)) {
      if (typeof value === 'function' && (value as any)._partialRefs) {
        refs.push(...(value as any)._partialRefs)
      }
    }
  }

  return refs
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  async function parseExpr(code: string): Promise<any> {
    const { parse } = await import('@typescript-eslint/typescript-estree')
    const ast = parse(`(${code})`, { range: true }) as any
    const node = ast.body[0].expression
    return node.type === 'ParenthesizedExpression' ? node.expression : node
  }

  async function _parseStatement(code: string): Promise<any> {
    const { parse } = await import('@typescript-eslint/typescript-estree')
    const ast = parse(code, { range: true, filePath: 'test.ts' }) as any
    return ast.body[0]
  }

  async function getCallbackFromSelect(code: string, dollarParam = '$', varsParam?: string) {
    const expr = await parseExpr(code)
    const callback = expr.arguments?.[0]
      ?? expr.callee?.object?.arguments?.[0]
      ?? expr
    return { callback, dollarParam, varsParam }
  }

  function makePartialDef(name: string, typeName: string): StaticPartialDef {
    return {
      name,
      typeName,
      selectCallback: {} as any,
      callbackParams: { dollar: '$' },
    }
  }

  /**
   * Build a mock TypeContext whose nodeMap maps every SpreadElement callee
   * Identifier found inside `callbackNode` to a fake TS node, and whose
   * checker returns `fragmentName` through the resolvePartialFragmentName chain.
   */
  function makeTypeCtxForSpread(callbackNode: any, fragmentName: string): TypeContext {
    const nodeMap = new WeakMap<any, any>()
    const fakeTSNode = {}

    function walk(n: any): void {
      if (!n || typeof n !== 'object') {
        return
      }
      if (
        n.type === 'SpreadElement'
        && n.argument?.type === 'CallExpression'
        && n.argument.callee?.type === 'Identifier'
      ) {
        nodeMap.set(n.argument.callee, fakeTSNode)
      }
      for (const val of Object.values(n)) {
        if (Array.isArray(val)) {
          for (const item of val) {
            walk(item)
          }
        }
        else if (val && typeof val === 'object') {
          walk(val)
        }
      }
    }
    walk(callbackNode)

    const mockSymbol = {}
    const mockType = { isUnion: () => false }

    return {
      checker: {
        getTypeAtLocation: () => mockType,
        getPropertyOfType: (_t: any, name: string) =>
          name === ' $fragmentName' ? mockSymbol : undefined,
        getTypeOfSymbol: () => ({
          isUnion: () => false,
          isStringLiteral: () => true,
          value: fragmentName,
        }),
      } as any,
      nodeMap,
      builderNames: [],
      namespace: undefined,
    }
  }

  describe('interpretSelectCallback', () => {
    it('1. simple string fields: $.select(["id", "name"])', async () => {
      const { callback, dollarParam } = await getCallbackFromSelect(
        `gazania.query('Test').select($ => $.select(['id', 'name']))`,
      )
      const result = interpretSelectCallback(callback, dollarParam)

      expect(result.selection).toEqual(['id', 'name'])
      expect(result.partialRefs).toEqual([])
    })

    it('2. scalar shorthand: { user: true }', async () => {
      const { callback, dollarParam } = await getCallbackFromSelect(
        `gazania.query('Test').select($ => $.select([{ user: true }]))`,
      )
      const result = interpretSelectCallback(callback, dollarParam)

      expect(result.selection).toHaveLength(1)
      const obj = result.selection[0] as Record<string, any>
      expect(obj.user).toBe(true)
    })

    it('3. nested with args: { user: $ => $.args({...}).select([...]) }', async () => {
      const { callback, dollarParam } = await getCallbackFromSelect(
        `gazania.query('Test').select($ => $.select([{ user: $ => $.args({ id: 1 }).select(['name']) }]))`,
      )
      const result = interpretSelectCallback(callback, dollarParam)

      expect(result.selection).toHaveLength(1)
      const obj = result.selection[0] as Record<string, any>
      expect(typeof obj.user).toBe('function')

      const fieldDollar = { _args: undefined, _selection: undefined, _directives: undefined }
      obj.user(fieldDollar)
      expect(fieldDollar._args).toEqual({ id: 1 })
      expect(fieldDollar._selection).toEqual(['name'])
    })

    it('4. with directives: { user: $ => $.directives([...]).select([...]) }', async () => {
      const { callback, dollarParam } = await getCallbackFromSelect(
        `gazania.query('Test').select($ => $.select([{ user: $ => $.directives(['@skip', { if: true }]).select(['name']) }]))`,
      )
      const result = interpretSelectCallback(callback, dollarParam)

      expect(result.selection).toHaveLength(1)
      const obj = result.selection[0] as Record<string, any>
      expect(typeof obj.user).toBe('function')

      const fieldDollar = { _args: undefined, _selection: undefined, _directives: undefined }
      obj.user(fieldDollar)
      expect(fieldDollar._directives).toHaveLength(1)
      expect(fieldDollar._directives![0][0]).toBe('@skip')
      expect(fieldDollar._directives![0][1]).toEqual({ if: true })
      expect(fieldDollar._selection).toEqual(['name'])
    })

    it('5. variable reference in args: vars.id', async () => {
      const { callback } = await getCallbackFromSelect(
        `gazania.query('Test').vars({ id: 'ID!' }).select(($, vars) => $.select([{ user: $ => $.args({ id: vars.id }).select(['name']) }]))`,
      )
      const result = interpretSelectCallback(callback, '$', 'vars')

      const obj = result.selection[0] as Record<string, any>
      const fieldDollar: any = { _args: undefined, _selection: undefined, _directives: undefined }
      obj.user(fieldDollar)

      expect(fieldDollar._args.id).toBeInstanceOf(Variable)
      expect((fieldDollar._args.id as Variable).name).toBe('id')
    })

    it('6. enum value: $.enum("ANIME")', async () => {
      const { callback, dollarParam, varsParam } = await getCallbackFromSelect(
        `gazania.query('Test').select(($, vars) => $.select([{ media: $ => $.args({ type: $.enum('ANIME') }).select(['title']) }]))`,
      )
      const result = interpretSelectCallback(callback, dollarParam, varsParam)

      const obj = result.selection[0] as Record<string, any>
      const fieldDollar: any = { _args: undefined, _selection: undefined, _directives: undefined }
      obj.media(fieldDollar)

      expect(typeof fieldDollar._args.type).toBe('function')
      expect((fieldDollar._args.type as () => string)()).toBe('ANIME')
    })

    it('7. inline fragment: "... on Type": $ => $.select([...])', async () => {
      const { callback, dollarParam } = await getCallbackFromSelect(
        `gazania.query('Test').select($ => $.select([{ '... on User': $ => $.select(['id', 'name']) }]))`,
      )
      const result = interpretSelectCallback(callback, dollarParam)

      const obj = result.selection[0] as Record<string, any>
      expect(typeof obj['... on User']).toBe('function')

      const fieldDollar = { _args: undefined, _selection: undefined, _directives: undefined }
      obj['... on User'](fieldDollar)
      expect(fieldDollar._selection).toEqual(['id', 'name'])
    })

    it('8. generic inline fragment: "...": $ => $.select([...])', async () => {
      const { callback, dollarParam } = await getCallbackFromSelect(
        `gazania.query('Test').select($ => $.select([{ '...': $ => $.select(['id']) }]))`,
      )
      const result = interpretSelectCallback(callback, dollarParam)

      const obj = result.selection[0] as Record<string, any>
      expect(typeof obj['...']).toBe('function')

      const fieldDollar = { _args: undefined, _selection: undefined, _directives: undefined }
      obj['...'](fieldDollar)
      expect(fieldDollar._selection).toEqual(['id'])
    })

    it('9. partial spread: ...partialRef({})', async () => {
      const partials = new Map<string, StaticPartialDef>()
      partials.set('userPartial', makePartialDef('userPartial', 'User'))

      const code = `gazania.query('Test').select($ => $.select(['id', ...userPartial({})]))`
      const { callback, dollarParam } = await getCallbackFromSelect(code)
      const typeCtx = makeTypeCtxForSpread(callback, 'userPartial')
      const result = interpretSelectCallback(callback, dollarParam, undefined, partials, undefined, typeCtx)

      expect(result.selection).toEqual(['id'])
      expect(result.partialRefs).toHaveLength(1)
      expect(result.partialRefs[0].fragmentName).toBe('userPartial')
    })

    it('10. partial with vars: ...partialRef(vars)', async () => {
      const partials = new Map<string, StaticPartialDef>()
      partials.set('userPartial', makePartialDef('userPartial', 'User'))

      const code = `gazania.query('Test').vars({ id: 'ID!' }).select(($, vars) => $.select(['id', ...userPartial(vars)]))`
      const { callback, dollarParam, varsParam } = await getCallbackFromSelect(code, '$', 'vars')
      const typeCtx = makeTypeCtxForSpread(callback, 'userPartial')
      const result = interpretSelectCallback(callback, dollarParam, varsParam, partials, undefined, typeCtx)

      expect(result.selection).toEqual(['id'])
      expect(result.partialRefs).toHaveLength(1)
      expect(result.partialRefs[0].fragmentName).toBe('userPartial')
    })

    it('11. skipped patterns — unknown spread does not crash', async () => {
      const code = `gazania.query('Test').select($ => $.select(['id', ...dynamicExpr]))`
      const { callback, dollarParam } = await getCallbackFromSelect(code)
      const result = interpretSelectCallback(callback, dollarParam)

      expect(result.selection).toEqual(['id'])
      expect(result.partialRefs).toEqual([])
    })

    it('11b. skipped — non-literal dynamic value', async () => {
      const code = `gazania.query('Test').select($ => $.select(['id', someVar]))`
      const { callback, dollarParam } = await getCallbackFromSelect(code)
      const result = interpretSelectCallback(callback, dollarParam)

      expect(result.selection).toEqual(['id'])
      expect(result.partialRefs).toEqual([])
    })

    it('handles block-body arrow function', async () => {
      const code = `gazania.query('Test').select($ => { return $.select(['id']) })`
      const expr = await parseExpr(code)
      const callback = expr.arguments[0]
      const result = interpretSelectCallback(callback, '$')

      expect(result.selection).toEqual(['id'])
    })

    it('handles FunctionExpression', async () => {
      const code = `gazania.query('Test').select(function($) { return $.select(['id', 'name']) })`
      const expr = await parseExpr(code)
      const callback = expr.arguments[0]
      const result = interpretSelectCallback(callback, '$')

      expect(result.selection).toEqual(['id', 'name'])
    })

    it('returns empty result when no select call found', async () => {
      const code = `gazania.query('Test').select($ => $.args({ id: 1 }))`
      const expr = await parseExpr(code)
      const callback = expr.arguments[0]
      const result = interpretSelectCallback(callback, '$')

      expect(result.selection).toEqual([])
      expect(result.partialRefs).toEqual([])
    })

    it('mixed selection with string, object, and spread', async () => {
      const partials = new Map<string, StaticPartialDef>()
      partials.set('nameFields', makePartialDef('nameFields', 'User'))

      const code = `gazania.query('Test').select($ => $.select(['id', { active: true }, ...nameFields({})]))`
      const expr = await parseExpr(code)
      const callback = expr.arguments[0]
      const typeCtx = makeTypeCtxForSpread(callback, 'nameFields')
      const result = interpretSelectCallback(callback, '$', undefined, partials, undefined, typeCtx)

      expect(result.selection).toHaveLength(2)
      expect(result.selection[0]).toBe('id')
      expect((result.selection[1] as any).active).toBe(true)
      expect(result.partialRefs).toHaveLength(1)
      expect(result.partialRefs[0].fragmentName).toBe('nameFields')
    })
  })

  describe('interpretArgsObject', () => {
    it('extracts literal values from ObjectExpression', async () => {
      const obj = await parseExpr(`{ id: 1, name: 'test', active: true }`)
      const result = interpretArgsObject(obj, '$', 'vars')

      expect(result).toEqual({ id: 1, name: 'test', active: true })
    })

    it('resolves variable references', async () => {
      const obj = await parseExpr(`{ id: vars.userId }`)
      const result = interpretArgsObject(obj, '$', 'vars')

      expect(result.id).toBeInstanceOf(Variable)
      expect((result.id as Variable).name).toBe('userId')
    })

    it('resolves nested objects', async () => {
      const obj = await parseExpr(`{ filter: { status: 'active' } }`)
      const result = interpretArgsObject(obj, '$', 'vars')

      expect(result.filter).toEqual({ status: 'active' })
    })
  })

  describe('resolveValue', () => {
    it('resolves string literal', async () => {
      const node = await parseExpr(`'hello'`)
      expect(resolveValue(node, '$', 'vars')).toBe('hello')
    })

    it('resolves number literal', async () => {
      const node = await parseExpr(`42`)
      expect(resolveValue(node, '$', 'vars')).toBe(42)
    })

    it('resolves boolean literal', async () => {
      expect(resolveValue(await parseExpr('true'), '$', 'vars')).toBe(true)
      expect(resolveValue(await parseExpr('false'), '$', 'vars')).toBe(false)
    })

    it('resolves null literal', async () => {
      const node = await parseExpr(`null`)
      expect(resolveValue(node, '$', 'vars')).toBeNull()
    })

    it('resolves variable member expression', async () => {
      const node = await parseExpr(`vars.id`)
      const result = resolveValue(node, '$', 'vars')
      expect(result).toBeInstanceOf(Variable)
      expect((result as Variable).name).toBe('id')
    })

    it('resolves $.enum() call', async () => {
      const node = await parseExpr(`$.enum('ANIME')`)
      const result = resolveValue(node, '$', 'vars')
      expect(typeof result).toBe('function')
      expect((result as () => string)()).toBe('ANIME')
    })

    it('resolves array expression', async () => {
      const node = await parseExpr(`[1, 2, 3]`)
      expect(resolveValue(node, '$', 'vars')).toEqual([1, 2, 3])
    })

    it('resolves negative number', async () => {
      const node = await parseExpr(`-5`)
      expect(resolveValue(node, '$', 'vars')).toBe(-5)
    })

    it('returns undefined for unrecognized node types', async () => {
      const node = await parseExpr(`someFunction()`)
      expect(resolveValue(node, '$', 'vars')).toBeUndefined()
    })
  })

  describe('collectNestedPartialRefs', () => {
    it('collects refs from field callback functions', async () => {
      const partials = new Map<string, StaticPartialDef>()
      partials.set('nestedPartial', makePartialDef('nestedPartial', 'Item'))

      const code = `gazania.query('Test').select($ => $.select([{ user: $ => $.select([...nestedPartial({})]) }]))`
      const expr = await parseExpr(code)
      const callback = expr.arguments[0]
      const typeCtx = makeTypeCtxForSpread(callback, 'nestedPartial')
      const result = interpretSelectCallback(callback, '$', undefined, partials, undefined, typeCtx)

      const nestedRefs = collectNestedPartialRefs(result.selection)
      expect(nestedRefs).toHaveLength(1)
      expect(nestedRefs[0].fragmentName).toBe('nestedPartial')
    })

    it('returns empty array for plain selection', () => {
      const refs = collectNestedPartialRefs(['id', 'name'])
      expect(refs).toEqual([])
    })
  })
}
