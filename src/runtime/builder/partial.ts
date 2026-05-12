import type { DirectiveInput } from '../directive'
import type { SelectionInput } from '../dollar'
import type { Variable, VariableDefinitions } from '../variable'
import type { SelectCallback } from './root'
import type { FragmentRef } from '../../types/masking'
import { createFieldDollar } from '../dollar'
import { createEnumFunction } from '../enum'
import { PartialContentSymbol } from '../symbol'
import { createVariableProxy } from '../variable'
import { createFragmentBuilder } from './fragment'
import { createOperationBuilder } from './operation'
import { createRootDollar } from './root'

export interface PartialPackage<Name extends string = string> {
  ($: Record<string, Variable>, directives?: DirectiveInput[]): SelectionInput
  readonly ' $fragmentOf'?: FragmentRef<Name, string>
}

export interface PartialBuilder<Name extends string = string> {
  on: (typeName: string) => PartialBuilderOnType<Name>
}

export interface PartialBuilderOnType<Name extends string = string> {
  vars: (defs: VariableDefinitions) => PartialBuilderOnTypeWithVar<Name>
  directives: (fn: () => DirectiveInput[]) => PartialBuilderOnType<Name>
  select: (callback: SelectCallback) => PartialPackage<Name>
}

export interface PartialBuilderOnTypeWithVar<Name extends string = string> {
  directives: (fn: (vars: Record<string, Variable>) => DirectiveInput[]) => PartialBuilderOnTypeWithVar<Name>
  select: (callback: SelectCallback<Record<string, Variable>>) => PartialPackage<Name>
}

export function createPartialBuilder<const Name extends string>(name: Name): PartialBuilder<Name> {
  const enumFn = createEnumFunction()

  return {
    on(typeName: string): PartialBuilderOnType {
      let varDefs: VariableDefinitions | undefined
      let directivesFn: ((vars?: Record<string, Variable>) => DirectiveInput[]) | undefined

      const buildPartial = (selection: SelectionInput): PartialPackage<Name> => {
        const fragBuilderOnType = createFragmentBuilder(name).on(typeName)

        let fragmentDoc: ReturnType<typeof fragBuilderOnType.select>
        if (varDefs) {
          const fragWithVars = fragBuilderOnType.vars(varDefs)
          if (directivesFn) {
            fragWithVars.directives(directivesFn as (vars: Record<string, Variable>) => DirectiveInput[])
          }
          fragmentDoc = fragWithVars.select((_$, _vars) => {
            const d = createFieldDollar(enumFn)
            d._selection = selection
            return d
          })
        }
        else {
          if (directivesFn) {
            fragBuilderOnType.directives(directivesFn as () => DirectiveInput[])
          }
          fragmentDoc = fragBuilderOnType.select(() => {
            const d = createFieldDollar(enumFn)
            d._selection = selection
            return d
          })
        }

        return (_dollar, directives) => {
          const key = Symbol(PartialContentSymbol.description)
          return [{
            [key]: {
              _fragmentName: name,
              _documentNode: fragmentDoc,
              _directives: directives,
            },
          }] as unknown as SelectionInput
        }
      }

      const builderOnTypeWithVar: PartialBuilderOnTypeWithVar<Name> = {
        directives(fn: (vars: Record<string, Variable>) => DirectiveInput[]): PartialBuilderOnTypeWithVar<Name> {
          directivesFn = fn as (vars?: Record<string, Variable>) => DirectiveInput[]
          return builderOnTypeWithVar
        },
        select(callback: SelectCallback<Record<string, Variable>>): PartialPackage<Name> {
          const root = createRootDollar(enumFn)
          const vars = createVariableProxy()
          const result = callback(root, vars)
          return buildPartial(result._selection!)
        },
      }

      const builderOnType: PartialBuilderOnType<Name> = {
        vars(defs: VariableDefinitions): PartialBuilderOnTypeWithVar<Name> {
          varDefs = defs
          return builderOnTypeWithVar
        },
        directives(fn: () => DirectiveInput[]): PartialBuilderOnType<Name> {
          directivesFn = fn
          return builderOnType
        },
        select(callback: SelectCallback): PartialPackage<Name> {
          const root = createRootDollar(enumFn)
          const vars = createVariableProxy()
          const result = callback(root, vars)
          return buildPartial(result._selection!)
        },
      }

      return builderOnType
    },
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('partial builder', async () => {
    const { print } = await import('graphql')

    it('creates basic partial usage', () => {
      const userPartial = createPartialBuilder('UserFields')
        .on('User')
        .select($ => $.select(['id', 'name', 'email']))

      const doc = createOperationBuilder('query', 'GetUser')
        .vars({ id: 'ID!' })
        .select(($, vars) => $.select([{
          user: $ => $.args({ id: vars.id }).select([
            ...userPartial(vars),
            '__typename',
          ]),
        }]))

      const output = print(doc)
      expect(output).toContain('user(id: $id)')
      expect(output).toContain('...UserFields')
      expect(output).toContain('fragment UserFields on User')
    })

    it('creates partial with vars and spreads into query', () => {
      const userPartial = createPartialBuilder('UserFields')
        .on('User')
        .vars({ id: 'ID!' })
        .select(($, vars) => $.select([{
          userId: $ => $.args({ id: vars.id }).select(['id']),
        }]))

      const doc = createOperationBuilder('query', 'GetUser')
        .vars({ id: 'ID!' })
        .select(($, vars) => $.select([{
          user: $ => $.args({ id: vars.id }).select([
            ...userPartial(vars),
          ]),
        }]))

      const output = print(doc)
      expect(output).toContain('$id: ID!')
      expect(output).toContain('user(id: $id)')
      expect(output).toContain('...UserFields')
    })

    it('creates partial with directives on spread', () => {
      const userPartial = createPartialBuilder('UserFields')
        .on('User')
        .select($ => $.select(['id']))

      const doc = createOperationBuilder('query', 'GetUser')
        .select($ => $.select([{
          user: $ => $.select([
            ...userPartial({}, [['@cached', { ttl: 30 }]]),
          ]),
        }]))

      const output = print(doc)
      expect(output).toContain('...UserFields @cached(ttl: 30)')
      expect(output).toContain('fragment UserFields on User')
    })

    it('creates partial with definition directives', () => {
      const userPartial = createPartialBuilder('UserFields')
        .on('User')
        .directives(() => [['@deprecated', { reason: 'use NewFields' }]])
        .select($ => $.select(['id']))

      const doc = createOperationBuilder('query', 'GetUser')
        .select($ => $.select([{
          user: $ => $.select([...userPartial({})]),
        }]))

      const output = print(doc)
      expect(output).toContain('fragment UserFields on User @deprecated(reason: "use NewFields")')
    })

    it('creates partial with vars and definition directives', () => {
      const userPartial = createPartialBuilder('UserFields')
        .on('User')
        .vars({ skip: 'Boolean!' })
        .directives(vars => [['@skip', { if: vars.skip }]])
        .select($ => $.select(['id']))

      const doc = createOperationBuilder('query', 'GetUser')
        .vars({ skip: 'Boolean!' })
        .select(($, vars) => $.select([{
          user: $ => $.select([...userPartial(vars)]),
        }]))

      const output = print(doc)
      expect(output).toContain('fragment UserFields on User @skip(if: $skip)')
    })
  })
}
