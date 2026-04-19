/* eslint-disable no-console */
/* eslint-disable antfu/no-top-level-await */

/**
 * Persisted Queries Example
 *
 * This script demonstrates the persisted queries workflow:
 *
 * 1. Queries are defined using the Gazania builder (src/queries.ts).
 * 2. `pnpm extract` runs `gazania extract` to produce `gazania-manifest.json`
 *    with each operation's body and SHA-256 hash.
 * 3. At runtime we read the manifest instead of the live builder, so the
 *    Gazania runtime is only needed at dev/build time — not at runtime.
 * 4. Requests are sent using the query body from the manifest.
 *    On backends that support APQ / trusted documents, you would send
 *    just the `hash` (and omit the `body`) after the first request.
 */

import type { ResultOf, VariablesOf } from 'gazania'
import type { GetUser, GetUsers, Hello } from './queries'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const API = 'https://nitro-graphql-tester.pages.dev/graphql-user'

// ---------------------------------------------------------------------------
// Load the pre-generated manifest
// ---------------------------------------------------------------------------

interface ManifestEntry {
  body: string
  hash: string
}
interface Manifest {
  operations: Record<string, ManifestEntry>
  fragments: Record<string, ManifestEntry>
}

const manifest: Manifest = JSON.parse(
  await readFile(new URL('../gazania-manifest.json', import.meta.url), 'utf-8'),
)

// ---------------------------------------------------------------------------
// Minimal typed GraphQL client backed by the manifest
// ---------------------------------------------------------------------------

async function request<TResult, TVars extends Record<string, unknown>>(
  operationName: string,
  variables?: TVars,
): Promise<TResult> {
  const entry = manifest.operations[operationName]
  if (!entry) {
    throw new Error(`Operation "${operationName}" not found in manifest`)
  }

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: entry.body,
      operationName,
      variables,
    }),
  })

  const json = await res.json() as { data?: TResult, errors?: unknown[] }

  if (json.errors?.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
  }

  return json.data as TResult
}

// ---------------------------------------------------------------------------
// Show manifest summary
// ---------------------------------------------------------------------------

console.log('=== Persisted Query Manifest ===')
for (const [name, entry] of Object.entries(manifest.operations)) {
  console.log(`\n[${name}]`)
  console.log(`  hash : ${entry.hash}`)
  console.log(`  body :\n${entry.body.split('\n').map(l => `    ${l}`).join('\n')}`)
}
console.log()

// ---------------------------------------------------------------------------
// Verify hashes match the bodies (demonstrates hash stability)
// ---------------------------------------------------------------------------

console.log('=== Hash Verification ===')
for (const [name, entry] of Object.entries(manifest.operations)) {
  const [algo, expected] = entry.hash.split(':') as [string, string]
  const actual = createHash(algo).update(entry.body).digest('hex')
  const ok = actual === expected
  console.log(`  ${ok ? '✓' : '✗'} ${name}`)
}
console.log()

// ---------------------------------------------------------------------------
// Run live queries against the API using the manifest bodies
// ---------------------------------------------------------------------------

console.log('=== Live Queries ===')

// GetUsers
const usersData = await request<ResultOf<typeof GetUsers>>('GetUsers')
console.log('\nGetUsers →', usersData.users)

// GetUser (fetch the first user by ID)
const firstId = usersData.users?.[0]?.id
if (firstId) {
  const userData = await request<ResultOf<typeof GetUser>, VariablesOf<typeof GetUser>>(
    'GetUser',
    { id: firstId },
  )
  console.log(`\nGetUser(id: "${firstId}") →`, userData.user)
}

// Hello
const helloData = await request<ResultOf<typeof Hello>, VariablesOf<typeof Hello>>(
  'Hello',
  { name: 'Gazania' },
)
console.log('\nHello(name: "Gazania") →', helloData.hello)
