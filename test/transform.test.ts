import { describe, expect, it } from 'vitest'
import { evaluateGazaniaExpressions } from '../src/transform/evaluate'
import { walkAST } from '../src/transform/walk'

// Helper: parse JS code to ESTree AST using acorn
async function parseCode(code: string) {
  const acorn = await import('acorn')
  return acorn.parse(code, {
    sourceType: 'module',
    ecmaVersion: 'latest',
  }) as any
}

describe('walkAST', () => {
  it('visits all nodes in a simple AST', async () => {
    const ast = await parseCode(`const x = 1`)
    const types: string[] = []
    walkAST(ast, node => types.push(node.type))
    expect(types).toContain('Program')
    expect(types).toContain('VariableDeclaration')
    expect(types).toContain('Literal')
  })
})

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

    // Should be skipped because myField is external
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

    // The replaced expression should be the builder call chain
    const original = code.slice(start, end)
    expect(original).toContain('gazania.query')
    expect(original).toContain('.select(')
  })
})
