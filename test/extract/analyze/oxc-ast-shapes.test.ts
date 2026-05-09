import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'

function parseCode(code: string) {
  return parseSync('test.js', code).program as any
}

function getExpression(code: string) {
  const ast = parseCode(code)
  return ast.body[0].expression
}

describe('oxc-ast-shapes: gazania builder chain patterns', () => {
  it('1. full query chain: gazania.query().select()', () => {
    const expr = getExpression(
      `gazania.query('Test').select($ => $.select(['id']))`,
    )

    expect(expr.type).toBe('CallExpression')
    expect(expr.callee.type).toBe('MemberExpression')
    expect(expr.callee.property.name).toBe('select')

    const queryCall = expr.callee.object
    expect(queryCall.type).toBe('CallExpression')
    expect(queryCall.callee.type).toBe('MemberExpression')
    expect(queryCall.callee.object.name).toBe('gazania')
    expect(queryCall.callee.property.name).toBe('query')
    expect(queryCall.arguments[0].type).toBe('Literal')
    expect(queryCall.arguments[0].value).toBe('Test')

    const arrow = expr.arguments[0]
    expect(arrow.type).toBe('ArrowFunctionExpression')
    expect(arrow.params[0].name).toBe('$')
    expect(arrow.body.type).toBe('CallExpression')
    expect(arrow.body.callee.property.name).toBe('select')
  })

  it('2. vars chain: gazania.query().vars().select() with 2-param callback', () => {
    const expr = getExpression(
      `gazania.query('Test').vars({ id: 'ID!' }).select(($, vars) => $.select(['id']))`,
    )

    expect(expr.type).toBe('CallExpression')
    expect(expr.callee.property.name).toBe('select')

    const varsCall = expr.callee.object
    expect(varsCall.type).toBe('CallExpression')
    expect(varsCall.callee.property.name).toBe('vars')

    const varsArg = varsCall.arguments[0]
    expect(varsArg.type).toBe('ObjectExpression')
    expect(varsArg.properties[0].key.name).toBe('id')
    expect(varsArg.properties[0].value.type).toBe('Literal')
    expect(varsArg.properties[0].value.value).toBe('ID!')

    const arrow = expr.arguments[0]
    expect(arrow.type).toBe('ArrowFunctionExpression')
    expect(arrow.params).toHaveLength(2)
    expect(arrow.params[0].name).toBe('$')
    expect(arrow.params[1].name).toBe('vars')
  })

  it('3. selection array with Literal + ObjectExpression + ArrowFunctionExpression', () => {
    const ast = parseCode(
      `const sel = ['id', { user: $ => $.args({ id: vars.id }).select(['name']) }]`,
    )
    const arr = ast.body[0].declarations[0].init
    expect(arr.type).toBe('ArrayExpression')
    expect(arr.elements).toHaveLength(2)

    expect(arr.elements[0].type).toBe('Literal')
    expect(arr.elements[0].value).toBe('id')

    const obj = arr.elements[1]
    expect(obj.type).toBe('ObjectExpression')
    const prop = obj.properties[0]
    expect(prop.key.name).toBe('user')
    expect(prop.value.type).toBe('ArrowFunctionExpression')
  })

  it('4. SpreadElement with CallExpression argument', () => {
    const ast = parseCode(`const x = [...userPartial({})]`)
    const spread = ast.body[0].declarations[0].init.elements[0]
    expect(spread.type).toBe('SpreadElement')
    expect(spread.argument.type).toBe('CallExpression')
    expect(spread.argument.callee.name).toBe('userPartial')
    expect(spread.argument.arguments[0].type).toBe('ObjectExpression')
    expect(spread.argument.arguments[0].properties).toHaveLength(0)
  })

  it('5. ObjectExpression Property with key Identifier, value Literal(true)', () => {
    const ast = parseCode(`const x = { user: true }`)
    const obj = ast.body[0].declarations[0].init
    expect(obj.type).toBe('ObjectExpression')
    const prop = obj.properties[0]
    expect(prop.type).toBe('Property')
    expect(prop.key.type).toBe('Identifier')
    expect(prop.key.name).toBe('user')
    expect(prop.value.type).toBe('Literal')
    expect(prop.value.value).toBe(true)
  })

  it('6. ObjectExpression Property with value ArrowFunctionExpression', () => {
    const ast = parseCode(`const x = { user: $ => $.select(['id']) }`)
    const obj = ast.body[0].declarations[0].init
    const prop = obj.properties[0]
    expect(prop.key.name).toBe('user')
    expect(prop.value.type).toBe('ArrowFunctionExpression')
    expect(prop.value.params[0].name).toBe('$')
    expect(prop.value.body.type).toBe('CallExpression')
    expect(prop.value.body.callee.property.name).toBe('select')
  })

  it('7. MemberExpression: vars.id', () => {
    const expr = getExpression(`vars.id`)
    expect(expr.type).toBe('MemberExpression')
    expect(expr.object.type).toBe('Identifier')
    expect(expr.object.name).toBe('vars')
    expect(expr.property.type).toBe('Identifier')
    expect(expr.property.name).toBe('id')
    expect(expr.computed).toBe(false)
  })

  it('8. $.enum("ANIME") — CallExpression with MemberExpression callee', () => {
    const expr = getExpression(`$.enum('ANIME')`)
    expect(expr.type).toBe('CallExpression')
    expect(expr.callee.type).toBe('MemberExpression')
    expect(expr.callee.object.name).toBe('$')
    expect(expr.callee.property.name).toBe('enum')
    expect(expr.arguments).toHaveLength(1)
    expect(expr.arguments[0].type).toBe('Literal')
    expect(expr.arguments[0].value).toBe('ANIME')
  })

  it('9. Literal key "... on User" with ArrowFunctionExpression value', () => {
    const ast = parseCode(`const x = { '... on User': $ => $.select(['id']) }`)
    const obj = ast.body[0].declarations[0].init
    const prop = obj.properties[0]
    expect(prop.type).toBe('Property')
    expect(prop.key.type).toBe('Literal')
    expect(prop.key.value).toBe('... on User')
    expect(prop.value.type).toBe('ArrowFunctionExpression')
    expect(prop.value.params[0].name).toBe('$')
  })

  it('10. partial chain: gazania.partial().on().select()', () => {
    const expr = getExpression(
      `gazania.partial('X').on('T').select($ => $.select(['id']))`,
    )

    expect(expr.type).toBe('CallExpression')
    expect(expr.callee.property.name).toBe('select')

    const onCall = expr.callee.object
    expect(onCall.type).toBe('CallExpression')
    expect(onCall.callee.property.name).toBe('on')
    expect(onCall.arguments[0].type).toBe('Literal')
    expect(onCall.arguments[0].value).toBe('T')

    const partialCall = onCall.callee.object
    expect(partialCall.type).toBe('CallExpression')
    expect(partialCall.callee.object.name).toBe('gazania')
    expect(partialCall.callee.property.name).toBe('partial')
    expect(partialCall.arguments[0].value).toBe('X')
  })

  it('11. nested selection: $.select([{ field: $ => $.args({}) }])', () => {
    const expr = getExpression(`$.select([{ field: $ => $.args({}) }])`)
    expect(expr.type).toBe('CallExpression')
    expect(expr.callee.property.name).toBe('select')

    const arr = expr.arguments[0]
    expect(arr.type).toBe('ArrayExpression')

    const innerObj = arr.elements[0]
    expect(innerObj.type).toBe('ObjectExpression')
    const innerProp = innerObj.properties[0]
    expect(innerProp.key.name).toBe('field')
    expect(innerProp.value.type).toBe('ArrowFunctionExpression')

    const argsCall = innerProp.value.body
    expect(argsCall.type).toBe('CallExpression')
    expect(argsCall.callee.property.name).toBe('args')
    expect(argsCall.arguments[0].type).toBe('ObjectExpression')
  })

  it('12. boolean shorthand: { isActive: true } in selection array', () => {
    const ast = parseCode(`const sel = [{ isActive: true }]`)
    const arr = ast.body[0].declarations[0].init
    const prop = arr.elements[0].properties[0]
    expect(prop.key.name).toBe('isActive')
    expect(prop.value.type).toBe('Literal')
    expect(prop.value.value).toBe(true)
  })

  it('13. numeric literal in args: $.args({ limit: 10 })', () => {
    const expr = getExpression(`$.args({ limit: 10 })`)
    expect(expr.type).toBe('CallExpression')
    expect(expr.callee.property.name).toBe('args')
    const objArg = expr.arguments[0]
    expect(objArg.type).toBe('ObjectExpression')
    const prop = objArg.properties[0]
    expect(prop.key.name).toBe('limit')
    expect(prop.value.type).toBe('Literal')
    expect(prop.value.value).toBe(10)
  })
})
