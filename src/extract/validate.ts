import type { GraphQLSchema } from 'graphql'
import type { DocumentNode, FragmentDefinitionNode } from '../lib/graphql'
import type { ExtractManifest, ManifestEntry, ManifestFragmentEntry, SourceLoc } from './manifest'
import { NoDeprecatedCustomRule, parse, specifiedRules, validate, visit } from 'graphql'
import { Kind } from '../lib/graphql'

export interface ValidationError {
  loc: SourceLoc
  message: string
}

export interface ValidationWarning {
  loc: SourceLoc
  message: string
}

/**
 * Collect all fragment spread names referenced in a DocumentNode (recursively).
 */
function collectFragmentSpreads(doc: DocumentNode): Set<string> {
  const names = new Set<string>()
  visit(doc, {
    FragmentSpread(node) {
      names.add(node.name.value)
    },
  })
  return names
}

/**
 * Resolve all transitive fragment dependencies for a set of directly-referenced
 * fragment names. Returns a flat set including the initial names plus all
 * transitive dependencies.
 */
function resolveTransitiveFragments(
  directRefs: Set<string>,
  fragments: ExtractManifest['fragments'],
): Set<string> {
  const resolved = new Set<string>()
  const queue = [...directRefs]

  while (queue.length > 0) {
    const name = queue.pop()!
    if (resolved.has(name)) {
      continue
    }
    resolved.add(name)

    const entry = fragments[name]
    if (!entry) {
      continue
    }

    const doc = parse(entry.body) as DocumentNode
    const spreads = collectFragmentSpreads(doc)
    for (const spread of spreads) {
      if (!resolved.has(spread)) {
        queue.push(spread)
      }
    }
  }

  return resolved
}

/**
 * Validate all operations in a manifest against a GraphQL schema.
 *
 * For each operation, transitive fragment dependencies are resolved and merged
 * into a single document so that fragment spreads are satisfied during validation.
 *
 * Uses `specifiedRules` for standard validation errors and `NoDeprecatedCustomRule`
 * for deprecation warnings.
 */
export function validateManifest(
  manifest: ExtractManifest,
  schema: GraphQLSchema,
): { errors: ValidationError[], warnings: ValidationWarning[] } {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  for (const [_opName, entry] of Object.entries(manifest.operations)) {
    const opDoc = parse(entry.body) as DocumentNode

    const directSpreads = collectFragmentSpreads(opDoc)
    const allFragmentNames = resolveTransitiveFragments(directSpreads, manifest.fragments)
    const fragmentDefs: FragmentDefinitionNode[] = []
    for (const fragName of allFragmentNames) {
      const fragEntry = manifest.fragments[fragName]
      if (fragEntry) {
        const fragDoc = parse(fragEntry.body) as DocumentNode
        for (const def of fragDoc.definitions) {
          if (def.kind === 'FragmentDefinition') {
            fragmentDefs.push(def)
          }
        }
      }
    }

    const mergedDoc: DocumentNode = {
      kind: Kind.DOCUMENT,
      definitions: [...opDoc.definitions, ...fragmentDefs],
    }

    const ruleErrors = validate(schema, mergedDoc, specifiedRules)
    for (const loc of entry.locs) {
      for (const err of ruleErrors) {
        errors.push({
          loc,
          message: err.message,
        })
      }
    }

    const depWarnings = validate(schema, mergedDoc, [NoDeprecatedCustomRule])
    for (const loc of entry.locs) {
      for (const warn of depWarnings) {
        warnings.push({
          loc,
          message: warn.message,
        })
      }
    }
  }

  return { errors, warnings }
}

/**
 * Validate operations in a manifest against multiple schemas matched by schema hash.
 * Operations are grouped by their schemaHash and validated against the matching schema.
 * Fragments are resolved only within the same schema hash group.
 */
export function validateManifestBySchema(
  manifest: ExtractManifest,
  schemasByHash: Map<string, GraphQLSchema>,
  _options?: { strict?: boolean },
): { errors: ValidationError[], warnings: ValidationWarning[], unmatched: Array<{ name: string, loc: SourceLoc }> } {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const unmatched: Array<{ name: string, loc: SourceLoc }> = []

  const groups = new Map<string, {
    operations: Record<string, ManifestEntry>
    fragments: Record<string, ManifestFragmentEntry>
  }>()

  for (const [name, entry] of Object.entries(manifest.operations)) {
    const hash = entry.schemaHash
    if (!hash) {
      for (const loc of entry.locs) {
        unmatched.push({ name, loc })
      }
      continue
    }
    let group = groups.get(hash)
    if (!group) {
      group = { operations: {}, fragments: {} }
      groups.set(hash, group)
    }
    group.operations[name] = entry
  }

  for (const [name, entry] of Object.entries(manifest.fragments)) {
    const hash = entry.schemaHash
    if (!hash) {
      for (const loc of entry.locs) {
        unmatched.push({ name, loc })
      }
      continue
    }
    let group = groups.get(hash)
    if (!group) {
      group = { operations: {}, fragments: {} }
      groups.set(hash, group)
    }
    group.fragments[name] = entry
  }

  for (const [hash, groupManifest] of groups) {
    const schema = schemasByHash.get(hash)
    if (!schema) {
      for (const [name, entry] of Object.entries(groupManifest.operations)) {
        for (const loc of entry.locs) {
          unmatched.push({ name, loc })
        }
      }
      for (const [name, entry] of Object.entries(groupManifest.fragments)) {
        for (const loc of entry.locs) {
          unmatched.push({ name, loc })
        }
      }
      continue
    }

    const groupResult = validateManifest(groupManifest, schema)
    errors.push(...groupResult.errors)
    warnings.push(...groupResult.warnings)
  }

  return { errors, warnings, unmatched }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('validateManifest', async () => {
    const { buildSchema } = await import('graphql')

    function makeLoc() {
      return { file: 'test.ts', start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
    }

    function makeManifest(
      ops: Record<string, string>,
      frags: Record<string, string> = {},
    ): ExtractManifest {
      return {
        operations: Object.fromEntries(
          Object.entries(ops).map(([k, v]) => [k, { body: v, hash: '', locs: [makeLoc()] }]),
        ),
        fragments: Object.fromEntries(
          Object.entries(frags).map(([k, v]) => [k, { body: v, hash: '', locs: [{ ...makeLoc(), fragmentMode: 'fragment' as const }] }]),
        ),
      }
    }

    const baseSchema = buildSchema(`
      type Query {
        user(id: ID!): User
        users: [User!]!
      }
      type User {
        id: ID!
        name: String!
        email: String
        oldField: String @deprecated(reason: "Use name instead")
      }
    `)

    // 1. Valid operation → no errors, no warnings
    it('returns no errors for a valid operation', () => {
      const manifest = makeManifest({
        GetUser: `query GetUser($id: ID!) { user(id: $id) { id name } }`,
      })
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    // 2. Non-existent field → error
    it('reports error for non-existent field', () => {
      const manifest = makeManifest({
        Bad: `query Bad { user(id: "1") { id nonexistent } }`,
      })
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]!.message).toMatch(/Cannot query field/)
      expect(result.warnings).toEqual([])
    })

    // 3. Deprecated field → warning, no errors
    it('reports warning for deprecated field but no errors', () => {
      const manifest = makeManifest({
        Dep: `query Dep { user(id: "1") { id oldField } }`,
      })
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors).toEqual([])
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]!.message).toMatch(/deprecated/i)
    })

    // 4. Fragment reference → merged, no "Unknown fragment" error
    it('merges referenced fragments without errors', () => {
      const manifest = makeManifest(
        { WithFrag: `query WithFrag { user(id: "1") { ...UserFields } }` },
        { UserFields: `fragment UserFields on User { id name }` },
      )
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    // 5. Non-existent fragment → error
    it('reports error for non-existent fragment reference', () => {
      const manifest = makeManifest({
        Missing: `query Missing { user(id: "1") { ...Ghost } }`,
      })
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.message.includes('Ghost'))).toBe(true)
    })

    // 6. Transitive fragment deps (A → B → C) → all merged
    it('resolves transitive fragment dependencies (A → B → C)', () => {
      const manifest = makeManifest(
        { Trans: `query Trans { user(id: "1") { ...A } }` },
        {
          A: `fragment A on User { id ...B }`,
          B: `fragment B on User { name ...C }`,
          C: `fragment C on User { email }`,
        },
      )
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    // 7. Empty manifest → no errors, no warnings
    it('handles empty manifest', () => {
      const manifest = makeManifest({})
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    // 8. Multiple operations → each validated independently
    it('validates each operation independently', () => {
      const manifest = makeManifest({
        Good: `query Good { user(id: "1") { id } }`,
        Bad: `query Bad { user(id: "1") { bogus } }`,
      })
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]!.message).toContain('bogus')
    })

    // 9. Scalar field with sub-selection → error (ScalarLeafsRule)
    it('reports error for scalar field with sub-selection', () => {
      const manifest = makeManifest({
        SubSel: `query SubSel { user(id: "1") { id { x } } }`,
      })
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.message.includes('id'))).toBe(true)
    })

    // 10. Missing required argument → error (ProvidedRequiredArgumentsRule)
    it('reports error for missing required argument', () => {
      const manifest = makeManifest({
        NoArg: `query NoArg { user { id } }`,
      })
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    // Edge Case 1: Anonymous operations validated independently
    it('validates anonymous operations independently without LoneAnonymousOperationRule conflict', () => {
      const manifest = makeManifest({
        Anonymous_abc: `{ user(id: "1") { id } }`,
        Anonymous_def: `{ user(id: "1") { name } }`,
      })
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    // Edge Case 2: VariablesInAllowedPositionRule — type mismatch
    it('reports error when String variable is passed to ID! argument', () => {
      const manifest = makeManifest({
        TypeMismatch: `query GetUser($id: String) { user(id: $id) { id } }`,
      })
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    // Edge Case 3: Interface fragment spread — PossibleFragmentSpreadsRule
    it('allows inline fragment on concrete type implementing interface', () => {
      const ifaceSchema = buildSchema(`
        interface Node { id: ID! }
        type User implements Node { id: ID! name: String }
        type Query { node: Node }
      `)
      const manifest = makeManifest({
        Q: `query Q { node { ...on User { name } } }`,
      })
      const result = validateManifest(manifest, ifaceSchema)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    // Edge Case 4: Known directives — @skip passes validation
    it('allows @skip directive without errors', () => {
      const manifest = makeManifest({
        Q: `query Q { user(id: "1") { id name @skip(if: true) } }`,
      })
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors).toEqual([])
    })

    // Edge Case 5: Large manifest — 50 operations, no crash
    it('handles large manifest with 50 operations without errors', () => {
      const ops: Record<string, string> = {}
      for (let i = 0; i < 50; i++) {
        ops[`Op${i}`] = `query Op${i} { user(id: "1") { id } }`
      }
      const manifest = makeManifest(ops)
      const result = validateManifest(manifest, baseSchema)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })

  describe('validateManifestBySchema', async () => {
    const { buildSchema } = await import('graphql')

    function makeLoc() {
      return { file: 'test.ts', start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
    }

    function makeManifestWithHash(
      ops: Record<string, { body: string, schemaHash?: string }>,
      frags: Record<string, { body: string, schemaHash?: string }> = {},
    ): ExtractManifest {
      return {
        operations: Object.fromEntries(
          Object.entries(ops).map(([k, v]) => [k, { body: v.body, hash: '', locs: [makeLoc()], schemaHash: v.schemaHash }]),
        ),
        fragments: Object.fromEntries(
          Object.entries(frags).map(([k, v]) => [k, { body: v.body, hash: '', locs: [{ ...makeLoc(), fragmentMode: 'fragment' as const }], schemaHash: v.schemaHash }]),
        ),
      }
    }

    const schemaA = buildSchema(`
      type Query {
        user(id: ID!): User
      }
      type User {
        id: ID!
        name: String!
      }
    `)

    const schemaB = buildSchema(`
      type Query {
        post(id: ID!): Post
      }
      type Post {
        id: ID!
        title: String!
      }
    `)

    it('groups operations by schemaHash and validates against matching schema', () => {
      const manifest = makeManifestWithHash({
        GetUser: { body: `query GetUser($id: ID!) { user(id: $id) { id name } }`, schemaHash: 'hashA' },
        GetPost: { body: `query GetPost($id: ID!) { post(id: $id) { id title } }`, schemaHash: 'hashB' },
      })

      const schemasByHash = new Map<string, typeof schemaA>([
        ['hashA', schemaA],
        ['hashB', schemaB],
      ])

      const result = validateManifestBySchema(manifest, schemasByHash)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
      expect(result.unmatched).toEqual([])
    })

    it('reports errors only for the matching schema', () => {
      const manifest = makeManifestWithHash({
        BadUser: { body: `query BadUser { user(id: "1") { id bogus } }`, schemaHash: 'hashA' },
        GoodPost: { body: `query GoodPost { post(id: "1") { id title } }`, schemaHash: 'hashB' },
      })

      const schemasByHash = new Map<string, typeof schemaA>([
        ['hashA', schemaA],
        ['hashB', schemaB],
      ])

      const result = validateManifestBySchema(manifest, schemasByHash)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]!.message).toContain('bogus')
    })

    it('reports unmatched operations when no schemaHash is set', () => {
      const manifest = makeManifestWithHash({
        NoHash: { body: `query NoHash { user(id: "1") { id } }` },
      })

      const schemasByHash = new Map<string, typeof schemaA>([
        ['hashA', schemaA],
      ])

      const result = validateManifestBySchema(manifest, schemasByHash)
      expect(result.errors).toEqual([])
      expect(result.unmatched.length).toBe(1)
      expect(result.unmatched[0]!.name).toBe('NoHash')
    })

    it('reports unmatched when schemaHash does not match any configured schema', () => {
      const manifest = makeManifestWithHash({
        Unknown: { body: `query Unknown { something }`, schemaHash: 'unknownHash' },
      })

      const schemasByHash = new Map<string, typeof schemaA>([
        ['hashA', schemaA],
      ])

      const result = validateManifestBySchema(manifest, schemasByHash)
      expect(result.errors).toEqual([])
      expect(result.unmatched.length).toBe(1)
      expect(result.unmatched[0]!.name).toBe('Unknown')
    })

    it('resolves fragments only within the same schema hash group', () => {
      const manifest = makeManifestWithHash(
        {
          GetUser: { body: `query GetUser { user(id: "1") { ...UserFields } }`, schemaHash: 'hashA' },
        },
        {
          UserFields: { body: `fragment UserFields on User { id name }`, schemaHash: 'hashA' },
        },
      )

      const schemasByHash = new Map<string, typeof schemaA>([
        ['hashA', schemaA],
      ])

      const result = validateManifestBySchema(manifest, schemasByHash)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('does not resolve fragments from different schema hash groups', () => {
      const manifest = makeManifestWithHash(
        {
          GetPost: { body: `query GetPost { post(id: "1") { ...PostFields } }`, schemaHash: 'hashB' },
        },
        {
          PostFields: { body: `fragment PostFields on Post { id title }`, schemaHash: 'hashB' },
          UserFields: { body: `fragment UserFields on User { id name }`, schemaHash: 'hashA' },
        },
      )

      const schemasByHash = new Map<string, typeof schemaA>([
        ['hashA', schemaA],
        ['hashB', schemaB],
      ])

      const result = validateManifestBySchema(manifest, schemasByHash)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('handles empty manifest', () => {
      const manifest: ExtractManifest = { operations: {}, fragments: {} }
      const schemasByHash = new Map<string, typeof schemaA>([
        ['hashA', schemaA],
      ])

      const result = validateManifestBySchema(manifest, schemasByHash)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
      expect(result.unmatched).toEqual([])
    })

    it('handles empty schemasByHash', () => {
      const manifest = makeManifestWithHash({
        Op: { body: `query Op { something }`, schemaHash: 'hashA' },
      })

      const schemasByHash = new Map<string, typeof schemaA>()
      const result = validateManifestBySchema(manifest, schemasByHash)
      expect(result.errors).toEqual([])
      expect(result.unmatched.length).toBe(1)
    })
  })
}
