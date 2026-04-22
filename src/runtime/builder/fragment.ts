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
  selectLazy: (callback: SelectCallback) => () => Promise<DocumentNode>
}

export interface FragmentBuilderOnTypeWithVar {
  directives: (fn: (vars: Record<string, Variable>) => DirectiveInput[]) => FragmentBuilderOnTypeWithVar
  select: (callback: SelectCallback<Record<string, Variable>>) => DocumentNode
  selectLazy: (callback: SelectCallback<Record<string, Variable>>) => () => Promise<DocumentNode>
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

      const makeLazyDoc = (build: () => DocumentNode): DocumentNode => {
        let cached: DocumentNode | undefined
        return {
          kind: Kind.DOCUMENT,
          get definitions() {
            cached ??= build()
            return cached.definitions
          },
        } as DocumentNode
      }

      const builderOnTypeWithVar: FragmentBuilderOnTypeWithVar = {
        directives(fn: (vars: Record<string, Variable>) => DirectiveInput[]): FragmentBuilderOnTypeWithVar {
          directivesFn = fn as (vars?: Record<string, Variable>) => DirectiveInput[]
          return builderOnTypeWithVar
        },
        select(callback: SelectCallback<Record<string, Variable>>): DocumentNode {
          return makeLazyDoc(() => {
            const root = createRootDollar(enumFn)
            const vars = createVariableProxy()
            const result = callback(root, vars)
            return buildDocument(result._selection!)
          })
        },
        selectLazy(callback: SelectCallback<Record<string, Variable>>): () => Promise<DocumentNode> {
          const doc = builderOnTypeWithVar.select(callback)
          return () => Promise.resolve(doc)
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
          return makeLazyDoc(() => {
            const root = createRootDollar(enumFn)
            const vars = createVariableProxy()
            const result = callback(root, vars)
            return buildDocument(result._selection!)
          })
        },
        selectLazy(callback: SelectCallback): () => Promise<DocumentNode> {
          const doc = builderOnType.select(callback)
          return () => Promise.resolve(doc)
        },
      }

      return builderOnType
    },
  }
}

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest

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

    describe('lazy definitions', () => {
      it('does not call select callback before definitions are accessed', () => {
        const callback = vi.fn($ => $.select(['id']))
        const doc = createFragmentBuilder('LazyFrag').on('User').select(callback)
        expect(doc.kind).toBe('Document')
        expect(callback).not.toHaveBeenCalled()
        void doc.definitions
        expect(callback).toHaveBeenCalledOnce()
      })

      it('caches: callback called only once across multiple accesses', () => {
        const callback = vi.fn($ => $.select(['id']))
        const doc = createFragmentBuilder('CachedFrag').on('User').select(callback)
        void doc.definitions
        void doc.definitions
        expect(callback).toHaveBeenCalledOnce()
      })

      it('does not call select callback with vars before definitions are accessed', () => {
        const callback = vi.fn(($, _vars) => $.select(['id']))
        const doc = createFragmentBuilder('LazyFragVars')
          .on('User')
          .vars({ include: 'Boolean!' })
          .select(callback)
        expect(doc.kind).toBe('Document')
        expect(callback).not.toHaveBeenCalled()
        void doc.definitions
        expect(callback).toHaveBeenCalledOnce()
      })
    })

    describe('selectLazy', () => {
      it('returns a function, not a DocumentNode', () => {
        const lazyFn = createFragmentBuilder('SLFrag').on('User').selectLazy($ => $.select(['id']))
        expect(typeof lazyFn).toBe('function')
      })

      it('awaiting yields a correct fragment DocumentNode', async () => {
        const lazyFn = createFragmentBuilder('SLUserFrag').on('User').selectLazy($ => $.select(['id', 'name']))
        const doc = await lazyFn()
        expect(print(doc)).toMatchInlineSnapshot(`
          "fragment SLUserFrag on User {
            id
            name
          }"
        `)
      })

      it('works with vars', async () => {
        const lazyFn = createFragmentBuilder('SLFragVars')
          .on('User')
          .vars({ include: 'Boolean!' })
          .selectLazy(($, vars) => $.select([{
            email: $ => $.directives(['@include', { if: vars.include }]),
          }]))
        const doc = await lazyFn()
        expect(print(doc)).toContain('@include(if: $include)')
      })

      it('calling factory multiple times returns same document', async () => {
        const lazyFn = createFragmentBuilder('SLFragCached').on('User').selectLazy($ => $.select(['id']))
        const doc1 = await lazyFn()
        const doc2 = await lazyFn()
        expect(doc1).toBe(doc2)
      })
    })
  })
}
