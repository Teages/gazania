import type { DocumentNode } from '../../lib/graphql'
import { Kind } from '../../lib/graphql'

export function makeLazyDoc(build: () => DocumentNode): DocumentNode {
  let cached: DocumentNode | undefined

  return {
    kind: Kind.DOCUMENT,
    get definitions() {
      cached ??= build()
      return cached.definitions
    },
  } as DocumentNode
}
