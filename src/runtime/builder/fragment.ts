import type { DocumentNode } from '../../lib/graphql'
import type { DirectiveInput } from '../directive'
import type { SelectionInput } from '../dollar'
import type { Variable, VariableDefinitions } from '../variable'
import type { SelectCallback } from './root'
import { Kind } from '../../lib/graphql'
import { createDocumentNodeContext } from '../context'
import { parseDirectives } from '../directive'
import { createEnumFunction } from '../enum'
import { parseSelectionSet } from '../selection'
import { createVariableProxy } from '../variable'
import { createRootDollar } from './root'

export interface FragmentBuilder {
  on: (typeName: string) => FragmentBuilderOnType
}

export interface FragmentBuilderOnType {
  vars: (defs: VariableDefinitions) => FragmentBuilderOnTypeWithVar
  directives: (fn: () => DirectiveInput[]) => FragmentBuilderOnType
  select: (callback: SelectCallback) => DocumentNode
}

export interface FragmentBuilderOnTypeWithVar {
  directives: (fn: (vars: Record<string, Variable>) => DirectiveInput[]) => FragmentBuilderOnTypeWithVar
  select: (callback: SelectCallback<Record<string, Variable>>) => DocumentNode
}

export function createFragmentBuilder(name: string): FragmentBuilder {
  const enumFn = createEnumFunction()

  return {
    on(typeName: string): FragmentBuilderOnType {
      let varDefs: VariableDefinitions | undefined
      let directivesFn: ((vars?: Record<string, Variable>) => DirectiveInput[]) | undefined

      const buildDocument = (selection: SelectionInput): DocumentNode => {
        const ctx = createDocumentNodeContext()

        ctx.pushDefinition({
          kind: Kind.FRAGMENT_DEFINITION,
          name: { kind: Kind.NAME, value: name },
          typeCondition: {
            kind: Kind.NAMED_TYPE,
            name: { kind: Kind.NAME, value: typeName },
          },
          directives: directivesFn
            ? parseDirectives(directivesFn(varDefs ? createVariableProxy() : undefined))
            : [],
          selectionSet: parseSelectionSet(selection, ctx, enumFn),
        } as any)

        return {
          kind: Kind.DOCUMENT,
          definitions: ctx.definitions.reverse(),
        }
      }

      const builderOnTypeWithVar: FragmentBuilderOnTypeWithVar = {
        directives(fn: (vars: Record<string, Variable>) => DirectiveInput[]): FragmentBuilderOnTypeWithVar {
          directivesFn = fn as (vars?: Record<string, Variable>) => DirectiveInput[]
          return builderOnTypeWithVar
        },
        select(callback: SelectCallback<Record<string, Variable>>): DocumentNode {
          const root = createRootDollar(enumFn)
          const vars = createVariableProxy()
          const result = callback(root, vars)
          return buildDocument(result._selection!)
        },
      }

      const builderOnType: FragmentBuilderOnType = {
        vars(defs: VariableDefinitions): FragmentBuilderOnTypeWithVar {
          varDefs = defs
          return builderOnTypeWithVar
        },
        directives(fn: () => DirectiveInput[]): FragmentBuilderOnType {
          directivesFn = fn
          return builderOnType
        },
        select(callback: SelectCallback): DocumentNode {
          const root = createRootDollar(enumFn)
          const vars = createVariableProxy()
          const result = callback(root, vars)
          return buildDocument(result._selection!)
        },
      }

      return builderOnType
    },
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('fragment builder', async () => {
    const { print } = await import('graphql')

    it('creates fragment', () => {
      const doc = createFragmentBuilder('UserFields')
        .on('User')
        .select($ => $.select(['id', 'name']))
      expect(print(doc)).toContain('fragment UserFields on User')
    })

    it('creates fragment with variables', () => {
      const doc = createFragmentBuilder('UserFields')
        .on('User')
        .vars({ includeEmail: 'Boolean!' })
        .select(($, vars) => $.select([
          'id',
          'name',
          {
            email: $ => $.directives(['@include', { if: vars.includeEmail }]),
          },
        ]))
      expect(print(doc)).toContain('fragment UserFields on User')
      expect(print(doc)).toContain('email @include(if: $includeEmail)')
    })

    it('creates fragment with directives', () => {
      const doc = createFragmentBuilder('UserFields')
        .on('User')
        .directives(() => [['@deprecated', { reason: 'use NewFields' }]])
        .select($ => $.select(['id']))
      expect(print(doc)).toContain('fragment UserFields on User @deprecated(reason: "use NewFields")')
    })

    it('creates fragment with vars and directives', () => {
      const doc = createFragmentBuilder('UserFields')
        .on('User')
        .vars({ skip: 'Boolean!' })
        .directives(vars => [['@skip', { if: vars.skip }]])
        .select(($, vars) => $.select([{
          id: $ => $.directives(['@include', { if: vars.skip }]),
        }]))
      expect(print(doc)).toContain('fragment UserFields on User @skip(if: $skip)')
    })
  })
}
