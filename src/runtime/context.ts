import type { ExecutableDefinitionNode } from '../lib/graphql'
import { Kind, OperationTypeNode } from '../lib/graphql'

export interface DocumentNodeContext {
  definitions: ExecutableDefinitionNode[]
  pushDefinition: (...nodes: ExecutableDefinitionNode[]) => void
}

export function createDocumentNodeContext(): DocumentNodeContext {
  const definitions: ExecutableDefinitionNode[] = []
  let hasOperation = false
  const fragmentNames = new Set<string>()

  return {
    definitions,
    pushDefinition(...nodes) {
      for (const node of nodes) {
        if (node.kind === Kind.FRAGMENT_DEFINITION) {
          if (fragmentNames.has(node.name.value)) {
            continue // skip duplicate fragments
          }
          fragmentNames.add(node.name.value)
        }
        else if (node.kind === Kind.OPERATION_DEFINITION) {
          if (hasOperation) {
            throw new Error('Unexpected multiple operations')
          }
          hasOperation = true
        }

        definitions.push(node)
      }
    },
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('context', () => {
    it('pushes operation definitions', () => {
      const ctx = createDocumentNodeContext()
      ctx.pushDefinition({
        kind: Kind.OPERATION_DEFINITION,
        operation: OperationTypeNode.QUERY,
        selectionSet: { kind: Kind.SELECTION_SET, selections: [] },
      } as any)
      expect(ctx.definitions).toHaveLength(1)
    })

    it('throws on multiple operations', () => {
      const ctx = createDocumentNodeContext()
      const op = {
        kind: Kind.OPERATION_DEFINITION,
        operation: OperationTypeNode.QUERY,
        selectionSet: { kind: Kind.SELECTION_SET, selections: [] },
      } as any
      ctx.pushDefinition(op)
      expect(() => ctx.pushDefinition({ ...op })).toThrow('Unexpected multiple operations')
    })

    it('deduplicates fragments by name', () => {
      const ctx = createDocumentNodeContext()
      const frag = {
        kind: Kind.FRAGMENT_DEFINITION,
        name: { kind: Kind.NAME, value: 'UserFields' },
        typeCondition: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: 'User' } },
        selectionSet: { kind: Kind.SELECTION_SET, selections: [] },
      } as any
      ctx.pushDefinition(frag)
      ctx.pushDefinition({ ...frag })
      expect(ctx.definitions).toHaveLength(1)
    })
  })
}
