import type { DocumentNode } from '../../src/lib/graphql'

/**
 * `.select()` returns a lazy DocumentNode: the callback runs and the selection
 * AST is built only on first `.definitions` access. Every bench case must
 * materialize the document, otherwise it measures closure creation instead of
 * the actual operation analysis.
 */
export function build(doc: DocumentNode): DocumentNode {
  void doc.definitions
  return doc
}
