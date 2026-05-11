import type { StaticBuilderChain, StaticDirectiveDef } from '../../../src/extract/analyze/types'
import type { DocumentNode } from '../../../src/lib/graphql'
import type { DirectiveInput } from '../../../src/runtime/directive'
import { parse } from '@typescript-eslint/typescript-estree'
import { describe, expect, it } from 'vitest'
import { analyzeBuilderChain, isGazaniaSelectCall } from '../../../src/extract/analyze/chain'
import { collectImports } from '../../../src/extract/analyze/imports'
import { interpretSelectCallback } from '../../../src/extract/analyze/selection'
import { walkAST } from '../../../src/extract/walk'
import { Kind, OperationTypeNode } from '../../../src/lib/graphql'
import { createDocumentNodeContext } from '../../../src/runtime/context'
import { parseDirectives } from '../../../src/runtime/directive'
import { createEnumFunction } from '../../../src/runtime/enum'
import { parseSelectionSet } from '../../../src/runtime/selection'
import { parseVariableDefinitions } from '../../../src/runtime/variable'

/**
 * Statically interpret a directive callback AST to produce DirectiveInput[].
 * Handles simple arrow/function callbacks that return an array of [name, args] tuples.
 */
function interpretDirectiveCallback(def: StaticDirectiveDef): DirectiveInput[] {
  const { callback } = def
  const body = callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression'
    ? (callback as any).body
    : null

  if (!body) {
    return []
  }

  let returnExpr: any = body
  if (body.type === 'BlockStatement') {
    for (const stmt of body.body) {
      if (stmt.type === 'ReturnStatement' && stmt.argument) {
        returnExpr = stmt.argument
        break
      }
    }
    if (returnExpr === body) {
      return []
    }
  }

  if (returnExpr.type !== 'ArrayExpression') {
    return []
  }

  const results: DirectiveInput[] = []
  for (const el of returnExpr.elements ?? []) {
    if (!el || el.type !== 'ArrayExpression' || el.elements.length < 2) {
      continue
    }
    const nameNode = el.elements[0]
    const argsNode = el.elements[1]
    if (nameNode?.type === 'Literal' && typeof nameNode.value === 'string') {
      const directiveName = nameNode.value as `@${string}`
      const args: Record<string, unknown> = {}
      if (argsNode?.type === 'ObjectExpression') {
        for (const prop of argsNode.properties) {
          if (prop.type === 'Property' && prop.key.type === 'Identifier' && prop.value.type === 'Literal') {
            args[prop.key.name] = prop.value.value
          }
        }
      }
      results.push([directiveName, args])
    }
  }

  return results
}

/**
 * Full static extraction pipeline: parse code → collect imports → find chains →
 * interpret selections → construct DocumentNode[].
 */
function staticExtract(code: string, filePath?: string): DocumentNode[] {
  const ast = parse(code, { range: true, filePath: filePath ?? 'test.js' }) as any
  const contextMap: Record<string, unknown> = {}
  const { builderNames, namespace } = collectImports(ast, contextMap)

  // Track variables assigned from builderName calls (e.g. const g = createGazania())
  walkAST(ast, (node: any) => {
    if (node.type !== 'VariableDeclaration') {
      return
    }
    for (const decl of node.declarations) {
      if (decl.id.type !== 'Identifier' || !decl.init) {
        continue
      }
      const init = decl.init
      if (
        init.type === 'CallExpression'
        && init.callee.type === 'Identifier'
        && builderNames.includes(init.callee.name)
      ) {
        builderNames.push(decl.id.name)
      }
    }
  })

  const chains: StaticBuilderChain[] = []
  walkAST(ast, (node: any) => {
    if (!isGazaniaSelectCall(node, builderNames, namespace)) {
      return
    }
    const chain = analyzeBuilderChain(node, builderNames, namespace)
    if (chain) {
      chains.push(chain)
    }
  })

  const documents: DocumentNode[] = []

  for (const chain of chains) {
    const { selection } = interpretSelectCallback(
      chain.selectCallback,
      chain.callbackParams.dollar,
      chain.callbackParams.vars,
    )

    const ctx = createDocumentNodeContext()
    const enumFn = createEnumFunction()

    if (chain.type === 'fragment') {
      const directives: DirectiveInput[] = chain.directives?.length
        ? chain.directives.flatMap(interpretDirectiveCallback)
        : []

      ctx.pushDefinition({
        kind: Kind.FRAGMENT_DEFINITION,
        name: { kind: Kind.NAME, value: chain.name },
        typeCondition: {
          kind: Kind.NAMED_TYPE,
          name: { kind: Kind.NAME, value: chain.typeName ?? 'Unknown' },
        },
        directives: parseDirectives(directives),
        selectionSet: parseSelectionSet(selection, ctx, enumFn),
      } as any)
    }
    else {
      const directives: DirectiveInput[] = chain.directives?.length
        ? chain.directives.flatMap(interpretDirectiveCallback)
        : []

      ctx.pushDefinition({
        kind: Kind.OPERATION_DEFINITION,
        operation: {
          query: OperationTypeNode.QUERY,
          mutation: OperationTypeNode.MUTATION,
          subscription: OperationTypeNode.SUBSCRIPTION,
        }[chain.type as 'query' | 'mutation' | 'subscription'],
        name: chain.name
          ? { kind: Kind.NAME, value: chain.name }
          : undefined,
        variableDefinitions: chain.variableDefs
          ? parseVariableDefinitions(chain.variableDefs)
          : [],
        directives: parseDirectives(directives),
        selectionSet: parseSelectionSet(selection, ctx, enumFn),
      })
    }

    documents.push({
      kind: Kind.DOCUMENT,
      definitions: ctx.definitions.reverse(),
    })
  }

  return documents
}

describe('staticExtract integration', () => {
  it('1. simple query (JS file)', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      gazania.query('TestQuery').select($ => $.select(['id', 'name']))
    `)

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const op = doc.definitions[0] as any
    expect(op.kind).toBe('OperationDefinition')
    expect(op.operation).toBe('query')
    expect(op.name.value).toBe('TestQuery')
    expect(op.selectionSet.selections).toHaveLength(2)
    expect(op.selectionSet.selections[0].name.value).toBe('id')
    expect(op.selectionSet.selections[1].name.value).toBe('name')
  })

  it('2. mutation with vars', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      gazania.mutation('CreateUser').vars({ input: 'CreateUserInput!' }).select(($, vars) => $.select([{ createUser: $ => $.args({ input: vars.input }).select(['id']) }]))
    `)

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const op = doc.definitions[0] as any
    expect(op.kind).toBe('OperationDefinition')
    expect(op.operation).toBe('mutation')
    expect(op.name.value).toBe('CreateUser')
    expect(op.variableDefinitions).toHaveLength(1)
    expect(op.variableDefinitions[0].variable.name.value).toBe('input')
    expect(op.selectionSet.selections).toHaveLength(1)
    expect(op.selectionSet.selections[0].name.value).toBe('createUser')
  })

  it('3. subscription', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      gazania.subscription('OnMessage').select($ => $.select(['message']))
    `)

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const op = doc.definitions[0] as any
    expect(op.kind).toBe('OperationDefinition')
    expect(op.operation).toBe('subscription')
    expect(op.name.value).toBe('OnMessage')
    expect(op.selectionSet.selections[0].name.value).toBe('message')
  })

  it('4. fragment with .on()', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      gazania.fragment('UserFields').on('User').select($ => $.select(['id', 'name']))
    `)

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const frag = doc.definitions[0] as any
    expect(frag.kind).toBe('FragmentDefinition')
    expect(frag.name.value).toBe('UserFields')
    expect(frag.typeCondition.name.value).toBe('User')
    expect(frag.selectionSet.selections).toHaveLength(2)
    expect(frag.selectionSet.selections[0].name.value).toBe('id')
    expect(frag.selectionSet.selections[1].name.value).toBe('name')
  })

  it('5. createGazania alias', () => {
    const docs = staticExtract(`
      import { createGazania } from 'gazania'
      const g = createGazania()
      g.query('Alias').select($ => $.select(['id']))
    `)

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const op = doc.definitions[0] as any
    expect(op.kind).toBe('OperationDefinition')
    expect(op.operation).toBe('query')
    expect(op.name.value).toBe('Alias')
    expect(op.selectionSet.selections[0].name.value).toBe('id')
  })

  it('6. enum values in args', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      gazania.query('Test').select($ => $.select([{ field: $ => $.args({ type: $.enum('ANIME') }).select(['id']) }]))
    `)

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const op = doc.definitions[0] as any
    expect(op.kind).toBe('OperationDefinition')
    expect(op.selectionSet.selections).toHaveLength(1)
    const field = op.selectionSet.selections[0]
    expect(field.name.value).toBe('field')
    expect(field.arguments).toHaveLength(1)
    expect(field.arguments[0].name.value).toBe('type')
    expect(field.arguments[0].value.kind).toBe('EnumValue')
    expect(field.arguments[0].value.value).toBe('ANIME')
  })

  it('7. multiple queries same file', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      const q1 = gazania.query('First').select($ => $.select(['id']))
      const q2 = gazania.query('Second').select($ => $.select(['name']))
    `)

    expect(docs).toHaveLength(2)

    expect(docs[0].kind).toBe('Document')
    const op1 = docs[0].definitions[0] as any
    expect(op1.kind).toBe('OperationDefinition')
    expect(op1.operation).toBe('query')
    expect(op1.name.value).toBe('First')
    expect(op1.selectionSet.selections[0].name.value).toBe('id')

    expect(docs[1].kind).toBe('Document')
    const op2 = docs[1].definitions[0] as any
    expect(op2.kind).toBe('OperationDefinition')
    expect(op2.operation).toBe('query')
    expect(op2.name.value).toBe('Second')
    expect(op2.selectionSet.selections[0].name.value).toBe('name')
  })

  it('8. operation with directives', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      gazania.query('Dir').directives(() => [['@cache', { ttl: 60 }]]).select($ => $.select(['id']))
    `)

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const op = doc.definitions[0] as any
    expect(op.kind).toBe('OperationDefinition')
    expect(op.name.value).toBe('Dir')
    expect(op.directives).toHaveLength(1)
    expect(op.directives[0].name.value).toBe('cache')
    expect(op.directives[0].arguments).toHaveLength(1)
    expect(op.directives[0].arguments[0].name.value).toBe('ttl')
    expect(op.selectionSet.selections[0].name.value).toBe('id')
  })

  it('9. TypeScript file (.ts)', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      gazania.query('TypedQuery').select($ => $.select(['id', 'name']))
    `, 'test.ts')

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const op = doc.definitions[0] as any
    expect(op.kind).toBe('OperationDefinition')
    expect(op.operation).toBe('query')
    expect(op.name.value).toBe('TypedQuery')
    expect(op.selectionSet.selections).toHaveLength(2)
  })

  it('10. TSX file (.tsx)', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      gazania.query('TsxQuery').select($ => $.select(['id']))
    `, 'test.tsx')

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const op = doc.definitions[0] as any
    expect(op.kind).toBe('OperationDefinition')
    expect(op.operation).toBe('query')
    expect(op.name.value).toBe('TsxQuery')
    expect(op.selectionSet.selections[0].name.value).toBe('id')
  })

  it('11. inline fragment', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      gazania.query('InlineTest').select($ => $.select([{ '... on User': $ => $.select(['name']) }]))
    `)

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const op = doc.definitions[0] as any
    expect(op.kind).toBe('OperationDefinition')
    expect(op.name.value).toBe('InlineTest')
    expect(op.selectionSet.selections).toHaveLength(1)
    const inline = op.selectionSet.selections[0]
    expect(inline.kind).toBe('InlineFragment')
    expect(inline.typeCondition.name.value).toBe('User')
    expect(inline.selectionSet.selections[0].name.value).toBe('name')
  })

  it('12. field with boolean shorthand', () => {
    const docs = staticExtract(`
      import { gazania } from 'gazania'
      gazania.query('Shorthand').select($ => $.select([{ id: true }]))
    `)

    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc.kind).toBe('Document')
    const op = doc.definitions[0] as any
    expect(op.kind).toBe('OperationDefinition')
    expect(op.name.value).toBe('Shorthand')
    expect(op.selectionSet.selections).toHaveLength(1)
    const field = op.selectionSet.selections[0]
    expect(field.kind).toBe('Field')
    expect(field.name.value).toBe('id')
    expect(field.selectionSet).toBeUndefined()
  })
})
