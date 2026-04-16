import type {
  ArgumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionNode,
  SelectionSetNode,
} from '../lib/graphql'
import type { DocumentNodeContext } from './context'
import type { FieldDollar, PartialResultValue, SelectionInput, SelectionObject, SelectionValue } from './dollar'
import type { EnumFunction } from './enum'
import { Kind } from '../lib/graphql'
import { parseArguments } from './argument'
import { parseDirectives } from './directive'
import { createFieldDollar } from './dollar'

export function parseSelectionSet(
  input: SelectionInput,
  ctx: DocumentNodeContext,
  enumFn?: EnumFunction,
): SelectionSetNode {
  const selections: SelectionNode[] = []

  for (const item of input) {
    if (typeof item === 'string') {
      // String shorthand: either 'fieldName' or 'alias: fieldName'
      selections.push(buildFieldFromString(item))
      continue
    }

    // Object: process keyed fields and symbol-keyed partials
    const obj = item as SelectionObject

    // Regular string keys: field definitions
    for (const [key, value] of Object.entries(obj)) {
      selections.push(buildSelectionNode(key, value as SelectionValue, ctx, enumFn))
    }

    // Symbol keys: partial (fragment spread) results
    for (const key of Object.getOwnPropertySymbols(obj)) {
      const partial = (obj as any)[key] as PartialResultValue
      selections.push(buildFragmentSpread(partial, ctx))
    }
  }

  if (selections.length === 0) {
    throw new Error('Empty selection set')
  }

  return {
    kind: Kind.SELECTION_SET,
    selections,
  }
}

function buildFieldFromString(field: string): FieldNode {
  const { alias, name } = parseFieldKey(field)
  return {
    kind: Kind.FIELD,
    alias: alias
      ? { kind: Kind.NAME, value: alias }
      : undefined,
    name: { kind: Kind.NAME, value: name },
  }
}

function buildSelectionNode(
  key: string,
  value: SelectionValue,
  ctx: DocumentNodeContext,
  enumFn?: EnumFunction,
): SelectionNode {
  // Resolve the callback to get FieldDollar state
  const dollar = resolveFieldValue(value, enumFn)

  const argNodes: readonly ArgumentNode[] = dollar._args
    ? parseArguments(dollar._args)
    : []

  const directiveNodes = parseDirectives(dollar._directives)

  const childSelectionSet: SelectionSetNode | undefined = dollar._selection
    ? parseSelectionSet(dollar._selection, ctx, enumFn)
    : undefined

  if (key.startsWith('...')) {
    return buildInlineFragment(key, childSelectionSet, directiveNodes)
  }

  return buildField(key, childSelectionSet, argNodes, directiveNodes)
}

function resolveFieldValue(value: SelectionValue, enumFn?: EnumFunction): FieldDollar {
  if (value === true) {
    return createFieldDollar(enumFn)
  }
  const dollar = createFieldDollar(enumFn)
  return value(dollar)
}

const ON_TYPENAME_REGEX = /^\.{3}\s+on\s+(\w+)$/
function buildInlineFragment(
  key: string,
  selectionSet: SelectionSetNode | undefined,
  directives: readonly import('graphql').DirectiveNode[],
): InlineFragmentNode {
  if (!selectionSet) {
    throw new Error('Inline fragment must have a selection set')
  }

  // '... on TypeName' or '...'
  const match = ON_TYPENAME_REGEX.exec(key)
  const typeName = match ? match[1] : undefined

  return {
    kind: Kind.INLINE_FRAGMENT,
    typeCondition: typeName
      ? {
          kind: Kind.NAMED_TYPE,
          name: { kind: Kind.NAME, value: typeName },
        }
      : undefined,
    selectionSet,
    directives,
  }
}

function buildField(
  key: string,
  selectionSet: SelectionSetNode | undefined,
  args: readonly ArgumentNode[],
  directives: readonly import('graphql').DirectiveNode[],
): FieldNode {
  const { alias, name } = parseFieldKey(key)
  return {
    kind: Kind.FIELD,
    alias: alias
      ? { kind: Kind.NAME, value: alias }
      : undefined,
    name: { kind: Kind.NAME, value: name },
    selectionSet,
    arguments: args.length > 0 ? args : undefined,
    directives,
  }
}

function parseFieldKey(key: string): { alias: string | undefined, name: string } {
  const colonIndex = key.indexOf(':')
  if (colonIndex === -1) {
    return { alias: undefined, name: key.trim() }
  }
  return {
    alias: key.slice(0, colonIndex).trim(),
    name: key.slice(colonIndex + 1).trim(),
  }
}

function buildFragmentSpread(
  partial: PartialResultValue,
  ctx: DocumentNodeContext,
): FragmentSpreadNode {
  // Push fragment definitions to context
  const doc = partial._documentNode as { definitions: FragmentDefinitionNode[] }
  ctx.pushDefinition(...doc.definitions)

  return {
    kind: Kind.FRAGMENT_SPREAD,
    name: { kind: Kind.NAME, value: partial._fragmentName },
    directives: parseDirectives(partial._directives),
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('selection', async () => {
    const { createDocumentNodeContext } = await import('./context')

    it('parses string fields', () => {
      const ctx = createDocumentNodeContext()
      const node = parseSelectionSet(['id', 'name'], ctx)
      expect(node.selections).toHaveLength(2)
      expect(node.selections[0].kind).toBe(Kind.FIELD)
    })

    it('parses alias strings', () => {
      const ctx = createDocumentNodeContext()
      const node = parseSelectionSet(['myId: id'], ctx)
      const field = node.selections[0] as any
      expect(field.alias.value).toBe('myId')
      expect(field.name.value).toBe('id')
    })

    it('parses object with callback (scalar)', () => {
      const ctx = createDocumentNodeContext()
      const node = parseSelectionSet([{
        hello: $ => $.args({ name: 'world' }),
      }], ctx)
      const field = node.selections[0] as any
      expect(field.name.value).toBe('hello')
      expect(field.arguments).toHaveLength(1)
    })

    it('parses object with true (scalar shorthand)', () => {
      const ctx = createDocumentNodeContext()
      const node = parseSelectionSet([{ id: true }], ctx)
      const field = node.selections[0] as any
      expect(field.name.value).toBe('id')
      expect(field.selectionSet).toBeUndefined()
    })

    it('parses nested selection (object field)', () => {
      const ctx = createDocumentNodeContext()
      const node = parseSelectionSet([{
        user: $ => $.select(['id', 'name']),
      }], ctx)
      const field = node.selections[0] as any
      expect(field.name.value).toBe('user')
      expect(field.selectionSet.selections).toHaveLength(2)
    })

    it('parses inline fragment with type condition', () => {
      const ctx = createDocumentNodeContext()
      const node = parseSelectionSet([{
        '... on Post': $ => $.select(['title']),
      }], ctx)
      const fragment = node.selections[0] as any
      expect(fragment.kind).toBe(Kind.INLINE_FRAGMENT)
      expect(fragment.typeCondition.name.value).toBe('Post')
    })

    it('parses generic inline fragment', () => {
      const ctx = createDocumentNodeContext()
      const node = parseSelectionSet([{
        '...': $ => $.select(['id']),
      }], ctx)
      const fragment = node.selections[0] as any
      expect(fragment.kind).toBe(Kind.INLINE_FRAGMENT)
      expect(fragment.typeCondition).toBeUndefined()
    })

    it('throws on empty selection set', () => {
      const ctx = createDocumentNodeContext()
      expect(() => parseSelectionSet([], ctx)).toThrow('Empty selection set')
    })

    it('throws on inline fragment without sub-selection', () => {
      const ctx = createDocumentNodeContext()
      expect(() => parseSelectionSet([{
        '... on Post': true,
      }], ctx)).toThrow('Inline fragment must have a selection set')
    })
  })
}
