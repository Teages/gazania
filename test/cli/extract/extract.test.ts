import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runExtract } from '../../../src/cli/extract'
import { extract } from '../../../src/extract'

const fixtureDir = fileURLToPath(new URL('fixture', import.meta.url))

async function getManifest() {
  const { manifest } = await extract({ dir: 'src', cwd: fixtureDir, tsconfig: 'tsconfig.json' })
  return manifest
}

describe('cli: extract operations', () => {
  it('extracts all 8 expected operations', async () => {
    const manifest = await getManifest()

    const opNames = Object.keys(manifest.operations)
    expect(opNames).toHaveLength(8)
    expect(opNames).toEqual(expect.arrayContaining([
      'GetUsers',
      'GetUsersWithFragment',
      'GetUsers_Vue',
      'GetUsersWithFragment_Vue',
      'GetUsers_Svelte',
      'GetUsersWithFragment_Svelte',
      'GetUsers_React',
      'GetUsersWithFragment_React',
    ]))
  })

  describe('simple queries (no partials)', () => {
    it('extracts GetUsers from index.ts', async () => {
      const manifest = await getManifest()
      expect(manifest.operations).toHaveProperty('GetUsers')
      expect(manifest.operations.GetUsers!.body).toMatchInlineSnapshot(`
        "query GetUsers {
          users {
            id
            name
          }
        }"
      `)
    })

    it('extracts GetUsers_Vue from Vue SFC', async () => {
      const manifest = await getManifest()
      expect(manifest.operations).toHaveProperty('GetUsers_Vue')
      expect(manifest.operations.GetUsers_Vue!.body).toContain('query GetUsers_Vue')
    })

    it('extracts GetUsers_Svelte from Svelte SFC', async () => {
      const manifest = await getManifest()
      expect(manifest.operations).toHaveProperty('GetUsers_Svelte')
      expect(manifest.operations.GetUsers_Svelte!.body).toContain('query GetUsers_Svelte')
    })

    it('extracts GetUsers_React from TSX file', async () => {
      const manifest = await getManifest()
      expect(manifest.operations).toHaveProperty('GetUsers_React')
      expect(manifest.operations.GetUsers_React!.body).toContain('query GetUsers_React')
    })
  })

  describe('queries with cross-file partials/sections', () => {
    it('extracts GetUsersWithFragment from index.ts (circular dependency)', async () => {
      // index.ts imports UserPartial/UserSection from fragments.ts,
      // while fragments.ts imports gazania from index.ts — a circular dependency.
      // A second evaluation pass is required to resolve this.
      const manifest = await getManifest()
      expect(manifest.operations).toHaveProperty('GetUsersWithFragment')
      const body = manifest.operations.GetUsersWithFragment!.body
      expect(body).toContain('...UserFragment')
      expect(body).toContain('...UserSection')
      expect(body).toContain('fragment UserFragment on User')
      expect(body).toContain('fragment UserSection on User')
    })

    it('extracts GetUsersWithFragment_Vue from Vue SFC', async () => {
      const manifest = await getManifest()
      expect(manifest.operations).toHaveProperty('GetUsersWithFragment_Vue')
      const body = manifest.operations.GetUsersWithFragment_Vue!.body
      expect(body).toContain('...UserFragment')
      expect(body).toContain('...UserSection')
    })

    it('extracts GetUsersWithFragment_Svelte from Svelte SFC', async () => {
      const manifest = await getManifest()
      expect(manifest.operations).toHaveProperty('GetUsersWithFragment_Svelte')
      const body = manifest.operations.GetUsersWithFragment_Svelte!.body
      expect(body).toContain('...UserFragment')
      expect(body).toContain('...UserSection')
    })

    it('extracts GetUsersWithFragment_React from TSX file', async () => {
      const manifest = await getManifest()
      expect(manifest.operations).toHaveProperty('GetUsersWithFragment_React')
      const body = manifest.operations.GetUsersWithFragment_React!.body
      expect(body).toContain('...UserFragment')
      expect(body).toContain('...UserSection')
    })
  })

  it('produces a sha256 hash for every operation', async () => {
    const manifest = await getManifest()
    for (const [, entry] of Object.entries(manifest.operations)) {
      expect(entry.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    }
  })

  it('produces identical fragment spreads regardless of which framework file defines the query', async () => {
    // All *WithFragment queries spread the same partials/sections so their
    // inline fragment bodies should be identical even though they originate
    // from different framework files.
    const manifest = await getManifest()
    const names = [
      'GetUsersWithFragment',
      'GetUsersWithFragment_Vue',
      'GetUsersWithFragment_Svelte',
      'GetUsersWithFragment_React',
    ]
    for (const name of names) {
      const body = manifest.operations[name]!.body
      expect(body).toContain('...UserFragment')
      expect(body).toContain('...UserSection')
      expect(body).toContain('fragment UserFragment on User')
      expect(body).toContain('fragment UserSection on User')
    }
  })
})

describe('feature: skipped call diagnostics', () => {
  it('produces no skipped entries when tsconfig is provided and all partials resolve', async () => {
    const { skipped } = await extract({ dir: 'src', cwd: fixtureDir, tsconfig: 'tsconfig.json' })
    expect(skipped).toHaveLength(0)
  })

  it('throws when tsconfig is not provided', async () => {
    await expect(extract({ dir: 'src', cwd: fixtureDir }))
      .rejects.toThrow('tsconfig is required')
  })

  it('runExtract throws when tsconfig is not provided', async () => {
    const { vi } = await import('vitest')
    const { join } = await import('node:path')
    const { mkdir, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')

    const dir = join(tmpdir(), `gazania-e2e-warn-${Date.now()}`)
    await mkdir(join(dir, 'src'), { recursive: true })
    await writeFile(
      join(dir, 'src', 'query.js'),
      `import { gazania } from 'gazania'\nconst doc = gazania.query('E2EFail').select($ => $.select([...e2eMissing({})]))`,
    )

    try {
      await expect(runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
      })).rejects.toThrow('tsconfig is required')
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
