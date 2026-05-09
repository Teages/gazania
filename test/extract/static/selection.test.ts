import type { StaticPartialDef } from '../../../src/extract/static/types'
import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'
import { collectNestedPartialRefs, interpretArgsObject, interpretSelectCallback, resolveValue } from '../../../src/extract/static/selection'
import { Variable } from '../../../src/runtime/variable'

function parseExpr(code: string): any {
  const ast = parseSync('test.js', `(${code})`).program as any
  const node = ast.body[0].expression
  return node.type === 'ParenthesizedExpression' ? node.expression : node
}

function parseStatement(code: string): any {
  const ast = parseSync('test.ts', code).program as any
  return ast.body[0]
}

function getCallbackFromSelect(code: string, dollarParam = '$', varsParam?: string) {
  const expr = parseExpr(code)
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

describe('interpretSelectCallback', () => {
  it('1. simple string fields: $.select(["id", "name"])', () => {
    const { callback, dollarParam } = getCallbackFromSelect(
      `gazania.query('Test').select($ => $.select(['id', 'name']))`,
    )
    const result = interpretSelectCallback(callback, dollarParam)

    expect(result.selection).toEqual(['id', 'name'])
    expect(result.partialRefs).toEqual([])
  })

  it('2. scalar shorthand: { user: true }', () => {
    const { callback, dollarParam } = getCallbackFromSelect(
      `gazania.query('Test').select($ => $.select([{ user: true }]))`,
    )
    const result = interpretSelectCallback(callback, dollarParam)

    expect(result.selection).toHaveLength(1)
    const obj = result.selection[0] as Record<string, any>
    expect(obj.user).toBe(true)
  })

  it('3. nested with args: { user: $ => $.args({...}).select([...]) }', () => {
    const { callback, dollarParam } = getCallbackFromSelect(
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

  it('4. with directives: { user: $ => $.directives([...]).select([...]) }', () => {
    const { callback, dollarParam } = getCallbackFromSelect(
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

  it('5. variable reference in args: vars.id', () => {
    const { callback } = getCallbackFromSelect(
      `gazania.query('Test').vars({ id: 'ID!' }).select(($, vars) => $.select([{ user: $ => $.args({ id: vars.id }).select(['name']) }]))`,
    )
    const result = interpretSelectCallback(callback, '$', 'vars')

    const obj = result.selection[0] as Record<string, any>
    const fieldDollar: any = { _args: undefined, _selection: undefined, _directives: undefined }
    obj.user(fieldDollar)

    expect(fieldDollar._args.id).toBeInstanceOf(Variable)
    expect((fieldDollar._args.id as Variable).name).toBe('id')
  })

  it('6. enum value: $.enum("ANIME")', () => {
    const { callback, dollarParam, varsParam } = getCallbackFromSelect(
      `gazania.query('Test').select(($, vars) => $.select([{ media: $ => $.args({ type: $.enum('ANIME') }).select(['title']) }]))`,
    )
    const result = interpretSelectCallback(callback, dollarParam, varsParam)

    const obj = result.selection[0] as Record<string, any>
    const fieldDollar: any = { _args: undefined, _selection: undefined, _directives: undefined }
    obj.media(fieldDollar)

    expect(typeof fieldDollar._args.type).toBe('function')
    expect((fieldDollar._args.type as () => string)()).toBe('ANIME')
  })

  it('7. inline fragment: "... on Type": $ => $.select([...])', () => {
    const { callback, dollarParam } = getCallbackFromSelect(
      `gazania.query('Test').select($ => $.select([{ '... on User': $ => $.select(['id', 'name']) }]))`,
    )
    const result = interpretSelectCallback(callback, dollarParam)

    const obj = result.selection[0] as Record<string, any>
    expect(typeof obj['... on User']).toBe('function')

    const fieldDollar = { _args: undefined, _selection: undefined, _directives: undefined }
    obj['... on User'](fieldDollar)
    expect(fieldDollar._selection).toEqual(['id', 'name'])
  })

  it('8. generic inline fragment: "...": $ => $.select([...])', () => {
    const { callback, dollarParam } = getCallbackFromSelect(
      `gazania.query('Test').select($ => $.select([{ '...': $ => $.select(['id']) }]))`,
    )
    const result = interpretSelectCallback(callback, dollarParam)

    const obj = result.selection[0] as Record<string, any>
    expect(typeof obj['...']).toBe('function')

    const fieldDollar = { _args: undefined, _selection: undefined, _directives: undefined }
    obj['...'](fieldDollar)
    expect(fieldDollar._selection).toEqual(['id'])
  })

  it('9. partial spread: ...partialRef({})', () => {
    const partials = new Map<string, StaticPartialDef>()
    partials.set('userPartial', makePartialDef('userPartial', 'User'))

    const code = `gazania.query('Test').select($ => $.select(['id', ...userPartial({})]))`
    const { callback, dollarParam } = getCallbackFromSelect(code)
    const result = interpretSelectCallback(callback, dollarParam, undefined, partials)

    expect(result.selection).toEqual(['id'])
    expect(result.partialRefs).toHaveLength(1)
    expect(result.partialRefs[0].localName).toBe('userPartial')
  })

  it('10. partial with vars: ...partialRef(vars)', () => {
    const partials = new Map<string, StaticPartialDef>()
    partials.set('userPartial', makePartialDef('userPartial', 'User'))

    const code = `gazania.query('Test').vars({ id: 'ID!' }).select(($, vars) => $.select(['id', ...userPartial(vars)]))`
    const { callback, dollarParam, varsParam } = getCallbackFromSelect(code, '$', 'vars')
    const result = interpretSelectCallback(callback, dollarParam, varsParam, partials)

    expect(result.selection).toEqual(['id'])
    expect(result.partialRefs).toHaveLength(1)
    expect(result.partialRefs[0].localName).toBe('userPartial')
  })

  it('11. skipped patterns — unknown spread does not crash', () => {
    const code = `gazania.query('Test').select($ => $.select(['id', ...dynamicExpr]))`
    const { callback, dollarParam } = getCallbackFromSelect(code)
    const result = interpretSelectCallback(callback, dollarParam)

    expect(result.selection).toEqual(['id'])
    expect(result.partialRefs).toEqual([])
  })

  it('11b. skipped — non-literal dynamic value', () => {
    const code = `gazania.query('Test').select($ => $.select(['id', someVar]))`
    const { callback, dollarParam } = getCallbackFromSelect(code)
    const result = interpretSelectCallback(callback, dollarParam)

    expect(result.selection).toEqual(['id'])
    expect(result.partialRefs).toEqual([])
  })

  it('handles block-body arrow function', () => {
    const code = `gazania.query('Test').select($ => { return $.select(['id']) })`
    const expr = parseExpr(code)
    const callback = expr.arguments[0]
    const result = interpretSelectCallback(callback, '$')

    expect(result.selection).toEqual(['id'])
  })

  it('handles FunctionExpression', () => {
    const code = `gazania.query('Test').select(function($) { return $.select(['id', 'name']) })`
    const expr = parseExpr(code)
    const callback = expr.arguments[0]
    const result = interpretSelectCallback(callback, '$')

    expect(result.selection).toEqual(['id', 'name'])
  })

  it('returns empty result when no select call found', () => {
    const code = `gazania.query('Test').select($ => $.args({ id: 1 }))`
    const expr = parseExpr(code)
    const callback = expr.arguments[0]
    const result = interpretSelectCallback(callback, '$')

    expect(result.selection).toEqual([])
    expect(result.partialRefs).toEqual([])
  })

  it('mixed selection with string, object, and spread', () => {
    const partials = new Map<string, StaticPartialDef>()
    partials.set('nameFields', makePartialDef('nameFields', 'User'))

    const code = `gazania.query('Test').select($ => $.select(['id', { active: true }, ...nameFields({})]))`
    const expr = parseExpr(code)
    const callback = expr.arguments[0]
    const result = interpretSelectCallback(callback, '$', undefined, partials)

    expect(result.selection).toHaveLength(2)
    expect(result.selection[0]).toBe('id')
    expect((result.selection[1] as any).active).toBe(true)
    expect(result.partialRefs).toHaveLength(1)
    expect(result.partialRefs[0].localName).toBe('nameFields')
  })
})

describe('interpretArgsObject', () => {
  it('extracts literal values from ObjectExpression', () => {
    const obj = parseExpr(`{ id: 1, name: 'test', active: true }`)
    const result = interpretArgsObject(obj, '$', 'vars')

    expect(result).toEqual({ id: 1, name: 'test', active: true })
  })

  it('resolves variable references', () => {
    const obj = parseExpr(`{ id: vars.userId }`)
    const result = interpretArgsObject(obj, '$', 'vars')

    expect(result.id).toBeInstanceOf(Variable)
    expect((result.id as Variable).name).toBe('userId')
  })

  it('resolves nested objects', () => {
    const obj = parseExpr(`{ filter: { status: 'active' } }`)
    const result = interpretArgsObject(obj, '$', 'vars')

    expect(result.filter).toEqual({ status: 'active' })
  })
})

describe('resolveValue', () => {
  it('resolves string literal', () => {
    const node = parseExpr(`'hello'`)
    expect(resolveValue(node, '$', 'vars')).toBe('hello')
  })

  it('resolves number literal', () => {
    const node = parseExpr(`42`)
    expect(resolveValue(node, '$', 'vars')).toBe(42)
  })

  it('resolves boolean literal', () => {
    expect(resolveValue(parseExpr('true'), '$', 'vars')).toBe(true)
    expect(resolveValue(parseExpr('false'), '$', 'vars')).toBe(false)
  })

  it('resolves null literal', () => {
    const node = parseExpr(`null`)
    expect(resolveValue(node, '$', 'vars')).toBeNull()
  })

  it('resolves variable member expression', () => {
    const node = parseExpr(`vars.id`)
    const result = resolveValue(node, '$', 'vars')
    expect(result).toBeInstanceOf(Variable)
    expect((result as Variable).name).toBe('id')
  })

  it('resolves $.enum() call', () => {
    const node = parseExpr(`$.enum('ANIME')`)
    const result = resolveValue(node, '$', 'vars')
    expect(typeof result).toBe('function')
    expect((result as () => string)()).toBe('ANIME')
  })

  it('resolves array expression', () => {
    const node = parseExpr(`[1, 2, 3]`)
    expect(resolveValue(node, '$', 'vars')).toEqual([1, 2, 3])
  })

  it('resolves negative number', () => {
    const node = parseExpr(`-5`)
    expect(resolveValue(node, '$', 'vars')).toBe(-5)
  })

  it('returns undefined for unrecognized node types', () => {
    const node = parseExpr(`someFunction()`)
    expect(resolveValue(node, '$', 'vars')).toBeUndefined()
  })
})

describe('collectNestedPartialRefs', () => {
  it('collects refs from field callback functions', () => {
    const partials = new Map<string, StaticPartialDef>()
    partials.set('nestedPartial', makePartialDef('nestedPartial', 'Item'))

    const code = `gazania.query('Test').select($ => $.select([{ user: $ => $.select([...nestedPartial({})]) }]))`
    const expr = parseExpr(code)
    const callback = expr.arguments[0]
    const result = interpretSelectCallback(callback, '$', undefined, partials)

    const nestedRefs = collectNestedPartialRefs(result.selection)
    expect(nestedRefs).toHaveLength(1)
    expect(nestedRefs[0].localName).toBe('nestedPartial')
  })

  it('returns empty array for plain selection', () => {
    const refs = collectNestedPartialRefs(['id', 'name'])
    expect(refs).toEqual([])
  })
})
