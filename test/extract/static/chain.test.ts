import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'
import {
  analyzeBuilderChain,
  collectExports,
  collectImports,
  collectLiteralVariables,
  isGazaniaChainRoot,
  isGazaniaSelectCall,
} from '../../../src/extract/static/chain'

function parseCode(code: string) {
  return parseSync('test.js', code).program as any
}

function getExpression(code: string) {
  const ast = parseCode(code)
  return ast.body[0].expression
}

function _getLastExpression(code: string) {
  const ast = parseCode(code)
  const last = ast.body[ast.body.length - 1]
  return last.type === 'ExpressionStatement' ? last.expression : last.declarations?.[0]?.init
}

describe('analyzeBuilderChain', () => {
  it('extracts metadata from simple query chain', () => {
    const expr = getExpression(
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

  it('extracts metadata from mutation chain', () => {
    const expr = getExpression(
      `gazania.mutation('CreateUser').select($ => $.select(['id']))`,
    )
    const result = analyzeBuilderChain(expr, ['gazania'], undefined)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('mutation')
    expect(result!.name).toBe('CreateUser')
  })

  it('extracts metadata from subscription chain', () => {
    const expr = getExpression(
      `gazania.subscription('OnMessage').select($ => $.select(['id', 'text']))`,
    )
    const result = analyzeBuilderChain(expr, ['gazania'], undefined)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('subscription')
    expect(result!.name).toBe('OnMessage')
  })

  it('extracts metadata from fragment chain with .on()', () => {
    const expr = getExpression(
      `gazania.fragment('UserFields').on('User').select($ => $.select(['id', 'name']))`,
    )
    const result = analyzeBuilderChain(expr, ['gazania'], undefined)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('fragment')
    expect(result!.name).toBe('UserFields')
    expect(result!.typeName).toBe('User')
  })

  it('extracts metadata from partial chain', () => {
    const expr = getExpression(
      `gazania.partial('UserFields').on('User').select($ => $.select(['id']))`,
    )
    const result = analyzeBuilderChain(expr, ['gazania'], undefined)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('partial')
    expect(result!.name).toBe('UserFields')
    expect(result!.typeName).toBe('User')
  })

  it('extracts metadata from section chain', () => {
    const expr = getExpression(
      `gazania.section('UserFields').on('User').select($ => $.select(['id']))`,
    )
    const result = analyzeBuilderChain(expr, ['gazania'], undefined)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('section')
    expect(result!.name).toBe('UserFields')
    expect(result!.typeName).toBe('User')
  })

  it('extracts variable definitions from .vars()', () => {
    const expr = getExpression(
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

  it('extracts directive definitions from .directives()', () => {
    const expr = getExpression(
      `gazania.query('CachedQuery').directives(() => [['@cache', { maxAge: 60 }]]).select($ => $.select(['data']))`,
    )
    const result = analyzeBuilderChain(expr, ['gazania'], undefined)

    expect(result).not.toBeNull()
    expect(result!.directives).toHaveLength(1)
    expect(result!.directives![0].hasVarsParam).toBe(false)
    expect(result!.directives![0].callback.type).toBe('ArrowFunctionExpression')
  })

  it('extracts directives with vars parameter', () => {
    const expr = getExpression(
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

  it('returns null for non-.select() call', () => {
    const expr = getExpression(`gazania.query('Test')`)
    expect(analyzeBuilderChain(expr, ['gazania'], undefined)).toBeNull()
  })

  it('returns null for select call not on gazania chain', () => {
    const expr = getExpression(`something.select($ => $.select(['id']))`)
    expect(analyzeBuilderChain(expr, ['gazania'], undefined)).toBeNull()
  })

  it('returns null when select has no arguments', () => {
    const expr = getExpression(`gazania.query('Test').select()`)
    expect(analyzeBuilderChain(expr, ['gazania'], undefined)).toBeNull()
  })

  it('works with createGazania builder via builderNames', () => {
    const code = `const doc = createGazania().query('MyQuery').select($ => $.select(['id']))`
    const ast = parseCode(code)
    const init = ast.body[0].declarations[0].init
    const result = analyzeBuilderChain(init, ['createGazania'], undefined)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('query')
    expect(result!.name).toBe('MyQuery')
  })

  it('preserves source location', () => {
    const expr = getExpression(
      `gazania.query('Test').select($ => $.select(['id']))`,
    )
    const result = analyzeBuilderChain(expr, ['gazania'], undefined)

    expect(result).not.toBeNull()
    expect(typeof result!.loc.start).toBe('number')
    expect(typeof result!.loc.end).toBe('number')
    expect(result!.loc.start).toBeLessThan(result!.loc.end)
  })
})

describe('collectImports', () => {
  it('finds gazania import and populates builderNames', () => {
    const ast = parseCode(`import { gazania } from 'gazania'`)
    const contextMap: Record<string, unknown> = {}
    const result = collectImports(ast, contextMap)

    expect(result.builderNames).toEqual(['gazania'])
    expect(result.namespace).toBeUndefined()
    expect(result.hasRelevantImport).toBe(true)
    expect(contextMap.gazania).toBe(true)
  })

  it('finds createGazania import', () => {
    const ast = parseCode(`import { createGazania } from 'gazania'`)
    const contextMap: Record<string, unknown> = {}
    const result = collectImports(ast, contextMap)

    expect(result.builderNames).toEqual(['createGazania'])
    expect(result.hasRelevantImport).toBe(true)
  })

  it('handles namespace import', () => {
    const ast = parseCode(`import * as g from 'gazania'`)
    const contextMap: Record<string, unknown> = {}
    const result = collectImports(ast, contextMap)

    expect(result.builderNames).toEqual([])
    expect(result.namespace).toBe('g')
    expect(result.hasRelevantImport).toBe(true)
    expect(contextMap.g).toBe(true)
  })

  it('handles combined imports', () => {
    const ast = parseCode(`import { gazania, createGazania, something } from 'gazania'`)
    const contextMap: Record<string, unknown> = {}
    const result = collectImports(ast, contextMap)

    expect(result.builderNames).toContain('gazania')
    expect(result.builderNames).toContain('createGazania')
    expect(result.builderNames).toHaveLength(2)
  })

  it('returns empty for non-gazania imports', () => {
    const ast = parseCode(`import { something } from 'other'`)
    const contextMap: Record<string, unknown> = {}
    const result = collectImports(ast, contextMap)

    expect(result.builderNames).toEqual([])
    expect(result.namespace).toBeUndefined()
    expect(result.hasRelevantImport).toBe(false)
  })

  it('handles default import', () => {
    const ast = parseCode(`import gaz from 'gazania'`)
    const contextMap: Record<string, unknown> = {}
    const result = collectImports(ast, contextMap)

    expect(result.builderNames).toEqual([])
    expect(result.hasRelevantImport).toBe(true)
    expect(contextMap.gaz).toBe(true)
  })
})

describe('isGazaniaSelectCall', () => {
  it('identifies gazania select call', () => {
    const expr = getExpression(
      `gazania.query('Test').select($ => $.select(['id']))`,
    )
    expect(isGazaniaSelectCall(expr, ['gazania'], undefined)).toBe(true)
  })

  it('rejects non-select call', () => {
    const expr = getExpression(`gazania.query('Test')`)
    expect(isGazaniaSelectCall(expr, ['gazania'], undefined)).toBe(false)
  })

  it('rejects non-CallExpression', () => {
    expect(isGazaniaSelectCall({ type: 'Identifier', name: 'x' } as any, ['gazania'], undefined)).toBe(false)
  })

  it('rejects select call on non-gazania chain', () => {
    const expr = getExpression(`something.select($ => $.select(['id']))`)
    expect(isGazaniaSelectCall(expr, ['gazania'], undefined)).toBe(false)
  })

  it('recognizes namespace-based select call', () => {
    const expr = getExpression(
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

  it('recognizes namespace member access', () => {
    const node = getExpression(`g.query`)
    expect(isGazaniaChainRoot(node, [], 'g')).toBe(true)
  })

  it('recognizes chained call expression', () => {
    const node = getExpression(`gazania.query('Test')`)
    expect(isGazaniaChainRoot(node, ['gazania'], undefined)).toBe(true)
  })

  it('recognizes createGazania() direct call', () => {
    const node = getExpression(`createGazania()`)
    expect(isGazaniaChainRoot(node, ['createGazania'], undefined)).toBe(true)
  })
})

describe('collectExports', () => {
  it('handles export const', () => {
    const ast = parseCode(`export const myQuery = 'hello'`)
    const exports = collectExports(ast)

    expect(exports.get('myQuery')).toBe('myQuery')
  })

  it('handles export function', () => {
    const ast = parseCode(`export function myFn() { return 1 }`)
    const exports = collectExports(ast)

    expect(exports.get('myFn')).toBe('myFn')
  })

  it('handles export { x as y }', () => {
    const ast = parseCode(`const _x = 1\nexport { _x as myExport }`)
    const exports = collectExports(ast)

    expect(exports.get('myExport')).toBe('_x')
  })

  it('handles multiple export specifiers', () => {
    const ast = parseCode(`const a = 1\nconst b = 2\nexport { a as x, b as y }`)
    const exports = collectExports(ast)

    expect(exports.get('x')).toBe('a')
    expect(exports.get('y')).toBe('b')
  })

  it('returns empty map for file with no exports', () => {
    const ast = parseCode(`const x = 1`)
    const exports = collectExports(ast)

    expect(exports.size).toBe(0)
  })

  it('handles export const with multiple declarations', () => {
    const ast = parseCode(`export const a = 1, b = 2`)
    const exports = collectExports(ast)

    expect(exports.get('a')).toBe('a')
    expect(exports.get('b')).toBe('b')
  })
})

describe('collectLiteralVariables', () => {
  it('collects string literals', () => {
    const ast = parseCode(`const API = 'https://example.com'`)
    const vars = collectLiteralVariables(ast)

    expect(vars.get('API')).toBe('https://example.com')
  })

  it('collects numeric literals', () => {
    const ast = parseCode(`const MAX = 100`)
    const vars = collectLiteralVariables(ast)

    expect(vars.get('MAX')).toBe(100)
  })

  it('collects boolean literals', () => {
    const ast = parseCode(`const FLAG = true`)
    const vars = collectLiteralVariables(ast)

    expect(vars.get('FLAG')).toBe(true)
  })

  it('collects null literal', () => {
    const ast = parseCode(`const EMPTY = null`)
    const vars = collectLiteralVariables(ast)

    expect(vars.get('EMPTY')).toBe(null)
  })

  it('ignores non-literal initializers', () => {
    const ast = parseCode(`const x = someFunction()`)
    const vars = collectLiteralVariables(ast)

    expect(vars.has('x')).toBe(false)
  })

  it('ignores destructured declarations', () => {
    const ast = parseCode(`const { a } = obj`)
    const vars = collectLiteralVariables(ast)

    expect(vars.size).toBe(0)
  })

  it('collects multiple variables', () => {
    const ast = parseCode(`const A = 'hello'\nconst B = 42\nconst C = true`)
    const vars = collectLiteralVariables(ast)

    expect(vars.get('A')).toBe('hello')
    expect(vars.get('B')).toBe(42)
    expect(vars.get('C')).toBe(true)
    expect(vars.size).toBe(3)
  })
})
