import type { DocumentNode } from '../../lib/graphql'
import type { DirectiveInput } from '../directive'
import type { SelectionInput } from '../dollar'
import type { Variable, VariableDefinitions } from '../variable'
import type { SelectCallback } from './root'
import { Kind, OperationTypeNode } from '../../lib/graphql'
import { createDocumentNodeContext } from '../context'
import { parseDirectives } from '../directive'
import { createEnumFunction } from '../enum'
import { parseSelectionSet } from '../selection'
import { createVariableProxy, parseVariableDefinitions } from '../variable'
import { createRootDollar } from './root'

type OperationType = 'query' | 'mutation' | 'subscription'

export interface OperationBuilderWithoutVars {
  vars: (defs: VariableDefinitions) => OperationBuilderWithVars
  directives: (fn: () => DirectiveInput[]) => OperationBuilderWithoutVars
  select: (callback: SelectCallback) => DocumentNode
}

export interface OperationBuilderWithVars {
  directives: (fn: (vars: Record<string, Variable>) => DirectiveInput[]) => OperationBuilderWithVars
  select: (callback: SelectCallback<Record<string, Variable>>) => DocumentNode
}

export function createOperationBuilder(
  type: OperationType,
  name?: string,
): OperationBuilderWithoutVars {
  const enumFn = createEnumFunction()
  let varDefs: VariableDefinitions | undefined
  let directivesFn: ((vars?: Record<string, Variable>) => DirectiveInput[]) | undefined

  const buildDocument = (selection: SelectionInput): DocumentNode => {
    const ctx = createDocumentNodeContext()

    ctx.pushDefinition({
      kind: Kind.OPERATION_DEFINITION,
      operation: {
        query: OperationTypeNode.QUERY,
        mutation: OperationTypeNode.MUTATION,
        subscription: OperationTypeNode.SUBSCRIPTION,
      }[type],
      name: name
        ? { kind: Kind.NAME, value: name }
        : undefined,
      variableDefinitions: varDefs
        ? parseVariableDefinitions(varDefs)
        : [],
      directives: directivesFn
        ? parseDirectives(directivesFn(varDefs ? createVariableProxy() : undefined))
        : [],
      selectionSet: parseSelectionSet(selection, ctx, enumFn),
    })

    return {
      kind: Kind.DOCUMENT,
      definitions: ctx.definitions.reverse(),
    }
  }

  const withVarsBuilder: OperationBuilderWithVars = {
    directives(fn: (vars: Record<string, Variable>) => DirectiveInput[]) {
      directivesFn = fn as (vars?: Record<string, Variable>) => DirectiveInput[]
      return withVarsBuilder
    },
    select(callback: SelectCallback<Record<string, Variable>>): DocumentNode {
      const root = createRootDollar(enumFn)
      const vars = createVariableProxy()
      const result = callback(root, vars)
      return buildDocument(result._selection!)
    },
  }

  const builder: OperationBuilderWithoutVars = {
    vars(defs: VariableDefinitions): OperationBuilderWithVars {
      varDefs = defs
      return withVarsBuilder
    },
    directives(fn: () => DirectiveInput[]) {
      directivesFn = fn
      return builder
    },
    select(callback: SelectCallback): DocumentNode {
      const root = createRootDollar(enumFn)
      const vars = createVariableProxy()
      const result = callback(root, vars)
      return buildDocument(result._selection!)
    },
  }

  return builder
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('operation builder', async () => {
    const { print } = await import('graphql')

    it('creates anonymous query', () => {
      const doc = createOperationBuilder('query')
        .select($ => $.select(['id']))
      expect(print(doc)).toContain('id')
    })

    it('creates named query', () => {
      const doc = createOperationBuilder('query', 'MyQuery')
        .select($ => $.select(['id']))
      expect(print(doc)).toContain('query MyQuery')
    })

    it('creates mutation', () => {
      const doc = createOperationBuilder('mutation', 'CreateUser')
        .select($ => $.select(['id']))
      expect(print(doc)).toContain('mutation CreateUser')
    })

    it('creates subscription', () => {
      const doc = createOperationBuilder('subscription', 'OnMessage')
        .select($ => $.select(['id']))
      expect(print(doc)).toContain('subscription OnMessage')
    })

    it('handles vars chain', () => {
      const doc = createOperationBuilder('query', 'Test')
        .vars({ id: 'ID!' })
        .select(($, vars) => $.select([{
          user: $ => $.args({ id: vars.id }).select(['name']),
        }]))
      const output = print(doc)
      expect(output).toContain('$id: ID!')
      expect(output).toContain('user(id: $id)')
    })

    it('handles operation-level directives', () => {
      const doc = createOperationBuilder('query', 'Test')
        .directives(() => [['@cached', { ttl: 60 }]])
        .select($ => $.select(['data']))
      expect(print(doc)).toContain('@cached(ttl: 60)')
    })
  })
}
