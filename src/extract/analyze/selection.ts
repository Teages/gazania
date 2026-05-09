import type { Node } from 'estree'
import type { ArgumentMap } from '../../runtime/argument'
import type { DirectiveInput } from '../../runtime/directive'
import type { SelectionInput, SelectionObject } from '../../runtime/dollar'
import type { StaticPartialDef, StaticPartialRef, StaticSelectionResult } from './types'
import { Variable } from '../../runtime/variable'

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

  return interpretSelectionArray(selectionArray, dollarParam, varsParam, knownPartials, literalScope)
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
          obj[key] = interpretFieldCallback(value, dollarParam, varsParam, knownPartials, literalScope)
        }
      }

      selection.push(obj)
    }
    else if (element.type === 'SpreadElement') {
      const arg = element.argument
      if (arg.type === 'CallExpression' && arg.callee.type === 'Identifier') {
        const calleeName = arg.callee.name
        if (knownPartials?.has(calleeName)) {
          partialRefs.push({
            localName: calleeName,
            args: arg.arguments[0] ?? { type: 'ObjectExpression', properties: [] },
            loc: { start: arg.start, end: arg.end },
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
        nestedSelection = interpretSelectionArray(selArray, innerDollarParam, varsParam, knownPartials, literalScope)
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

    if (valueNode.type === 'ArrayExpression') {
      return (valueNode.elements ?? []).map(
        (el: any) => resolveValue(el, dollarParam, varsParam, literalScope),
      )
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
