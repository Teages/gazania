import type { DocumentNode } from 'graphql'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { print } from 'graphql'

export interface ExtractCommandOptions {
  dir: string
  output: string
  include: string
  algorithm: string
  silent: boolean
  cwd: string
}

export interface ManifestEntry {
  body: string
  hash: string
}

export interface ExtractManifest {
  operations: Record<string, ManifestEntry>
  fragments: Record<string, ManifestEntry>
}

/**
 * Recursively find files matching a simple glob pattern.
 * Supports patterns like `**.{ts,tsx,js,jsx}`.
 */
async function findFiles(dir: string, pattern: string): Promise<string[]> {
  const extensions = extractExtensions(pattern)
  const results: string[] = []
  await walkDir(dir, extensions, results)
  return results
}

function extractExtensions(pattern: string): Set<string> {
  // Parse patterns like **/*.{ts,tsx,js,jsx,vue,svelte} or **/*.ts
  const match = /\.\{([^}]+)\}$/.exec(pattern) || /\.(\w+)$/.exec(pattern)
  if (!match) {
    return new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'])
  }
  const exts = match[1]!.split(',').map(e => `.${e.trim()}`)
  return new Set(exts)
}

async function walkDir(dir: string, extensions: Set<string>, results: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  }
  catch {
    return
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue
      }
      await walkDir(fullPath, extensions, results)
    }
    else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf('.'))
      if (extensions.has(ext)) {
        results.push(fullPath)
      }
    }
  }
}

/**
 * Extract gazania queries from a single file's source code.
 * Handles Vue SFCs (.vue), Svelte components (.svelte), and plain JS/TS files.
 */
async function extractFromFile(filePath: string): Promise<DocumentNode[]> {
  const rawCode = await readFile(filePath, 'utf-8')

  if (!rawCode.includes('gazania')) {
    return []
  }

  const { getScriptBlocks } = await import('./preprocess')
  const { evaluateGazaniaExpressions } = await import('./evaluate')

  const blocks = getScriptBlocks(rawCode, filePath)
  const documents: DocumentNode[] = []

  for (const code of blocks) {
    if (!code.includes('gazania')) {
      continue
    }

    let ast
    // The code passed to evaluateGazaniaExpressions must match the AST.
    // Node.js strip-only mode preserves positions by replacing type syntax
    // with spaces, so evalCode.slice(pos) always gives the correct JS fragment.
    let evalCode = code
    try {
      const acorn = await import('acorn')
      ast = acorn.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        allowImportExpressions: true,
      })
    }
    catch {
      // If acorn can't parse (e.g. TypeScript), try stripping types first.
      try {
        evalCode = await stripTypes(code)
        const acorn = await import('acorn')
        ast = acorn.parse(evalCode, {
          sourceType: 'module',
          ecmaVersion: 'latest',
          allowImportExpressions: true,
        })
      }
      catch {
        continue
      }
    }

    const results = evaluateGazaniaExpressions(evalCode, ast as any)

    for (const result of results) {
      try {
        const doc = JSON.parse(result.replacement) as DocumentNode
        if (doc.kind === 'Document') {
          documents.push(doc)
        }
      }
      catch {
        // Skip invalid results
      }
    }
  }

  return documents
}

/**
 * Strip TypeScript type annotations using Node.js built-in module.
 * Returns the original code if type stripping is not available.
 */
async function stripTypes(code: string): Promise<string> {
  // Node.js 22.6+ has built-in type stripping
  try {
    const mod = await import('node:module') as any
    if (typeof mod.transformSync === 'function') {
      const result = mod.transformSync(code, { mode: 'strip-only' })
      return typeof result === 'string' ? result : result.code
    }
  }
  catch {
    // Not available — return original code
  }

  return code
}

function computeHash(body: string, algorithm: string): string {
  const hash = createHash(algorithm).update(body).digest('hex')
  return `${algorithm}:${hash}`
}

function getOperationName(doc: DocumentNode): { name: string | undefined, type: 'operation' | 'fragment' } {
  if (doc.definitions.length === 0) {
    return { name: undefined, type: 'operation' }
  }

  const firstDef = doc.definitions[0]!
  if (firstDef.kind === 'FragmentDefinition') {
    return { name: firstDef.name.value, type: 'fragment' }
  }
  if (firstDef.kind === 'OperationDefinition') {
    return { name: firstDef.name?.value, type: 'operation' }
  }

  return { name: undefined, type: 'operation' }
}

/**
 * Run the extract command.
 */
export async function runExtract(options: ExtractCommandOptions): Promise<void> {
  const { dir, output, include, algorithm, silent, cwd } = options
  const log = silent ? () => {} : (msg: string) => console.log(msg)

  const scanDir = join(cwd, dir)

  log(`Scanning ${relative(cwd, scanDir) || '.'}...`)

  const files = await findFiles(scanDir, include)

  log(`Found ${files.length} file(s) to scan.`)

  const manifest: ExtractManifest = {
    operations: {},
    fragments: {},
  }

  let totalFound = 0

  for (const file of files) {
    const documents = await extractFromFile(file)
    for (const doc of documents) {
      const body = print(doc)
      const hash = computeHash(body, algorithm)
      const { name, type } = getOperationName(doc)

      if (!name) {
        // Anonymous operations get a hash-based name using first 8 hex chars
        const HASH_PREFIX_LENGTH = 8
        const hashStart = hash.indexOf(':') + 1
        const anonKey = `Anonymous_${hash.slice(hashStart, hashStart + HASH_PREFIX_LENGTH)}`
        manifest.operations[anonKey] = { body, hash }
      }
      else if (type === 'fragment') {
        manifest.fragments[name] = { body, hash }
      }
      else {
        manifest.operations[name] = { body, hash }
      }

      totalFound++
    }
  }

  log(`Extracted ${totalFound} GraphQL document(s).`)

  const outputPath = join(cwd, output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')

  log(`Manifest written to ${outputPath}`)
}

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach, afterEach, vi } = import.meta.vitest
  const { existsSync } = await import('node:fs')
  const { mkdir: mkdirTest, readFile: readFileTest, rm, writeFile: writeFileTest } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')

  describe('runExtract', () => {
    let dir: string
    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    beforeEach(async () => {
      dir = join(tmpdir(), `gazania-extract-test-${Date.now()}`)
      await mkdirTest(dir, { recursive: true })
      await mkdirTest(join(dir, 'src'), { recursive: true })
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
      mockLog.mockClear()
    })

    it('generates an empty manifest when no gazania files found', async () => {
      await writeFileTest(
        join(dir, 'src', 'index.js'),
        `const x = 1`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations).toEqual({})
      expect(manifest.fragments).toEqual({})
    })

    it('extracts a simple query from a JS file', async () => {
      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const doc = gazania.query('TestQuery')
  .select($ => $.select(['id', 'name']))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations).toHaveProperty('TestQuery')
      expect(manifest.operations.TestQuery.body).toContain('query TestQuery')
      expect(manifest.operations.TestQuery.body).toContain('id')
      expect(manifest.operations.TestQuery.body).toContain('name')
      expect(manifest.operations.TestQuery.hash).toMatch(/^sha256:/)
    })

    it('extracts a mutation', async () => {
      await writeFileTest(
        join(dir, 'src', 'mutation.js'),
        `import { gazania } from 'gazania'
const doc = gazania.mutation('CreateUser')
  .vars({ input: 'CreateUserInput!' })
  .select(($, vars) => $.select([{
    createUser: $ => $.args({ input: vars.input }).select(['id', 'name']),
  }]))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations).toHaveProperty('CreateUser')
      expect(manifest.operations.CreateUser.body).toContain('mutation CreateUser')
    })

    it('extracts a fragment', async () => {
      await writeFileTest(
        join(dir, 'src', 'fragment.js'),
        `import { gazania } from 'gazania'
const doc = gazania.fragment('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name', 'email']))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.fragments).toHaveProperty('UserFields')
      expect(manifest.fragments.UserFields.body).toContain('fragment UserFields on User')
    })

    it('extracts multiple queries from multiple files', async () => {
      await writeFileTest(
        join(dir, 'src', 'a.js'),
        `import { gazania } from 'gazania'
const doc = gazania.query('QueryA').select($ => $.select(['fieldA']))`,
      )
      await writeFileTest(
        join(dir, 'src', 'b.js'),
        `import { gazania } from 'gazania'
const doc = gazania.query('QueryB').select($ => $.select(['fieldB']))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations).toHaveProperty('QueryA')
      expect(manifest.operations).toHaveProperty('QueryB')
    })

    it('creates output directory if needed', async () => {
      await writeFileTest(
        join(dir, 'src', 'index.js'),
        `const x = 1`,
      )

      await runExtract({
        dir: 'src',
        output: 'nested/dir/manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      expect(existsSync(join(dir, 'nested', 'dir', 'manifest.json'))).toBe(true)
    })

    it('logs output when not silent', async () => {
      await writeFileTest(
        join(dir, 'src', 'index.js'),
        `const x = 1`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: false,
        cwd: dir,
      })

      expect(mockLog).toHaveBeenCalled()
    })

    it('handles files that cannot be parsed', async () => {
      await writeFileTest(
        join(dir, 'src', 'broken.js'),
        `this is not valid javascript {{{`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations).toEqual({})
    })

    it('supports different hash algorithms', async () => {
      await writeFileTest(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const doc = gazania.query('TestQuery')
  .select($ => $.select(['id']))`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx}',
        algorithm: 'md5',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations.TestQuery.hash).toMatch(/^md5:/)
    })

    it('extracts a query from a .vue <script setup> block', async () => {
      await writeFileTest(
        join(dir, 'src', 'Comp.vue'),
        `<template><div>{{ data }}</div></template>
<script setup>
import { gazania } from 'gazania'
const VueQuery = gazania.query('VueQuery')
  .select($ => $.select(['id', 'name']))
</script>`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx,vue,svelte}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations).toHaveProperty('VueQuery')
      expect(manifest.operations.VueQuery.body).toContain('query VueQuery')
    })

    it('extracts queries from both <script> and <script setup> in a .vue file', async () => {
      await writeFileTest(
        join(dir, 'src', 'Comp.vue'),
        `<template><div/></template>
<script>
import { gazania } from 'gazania'
const VueFrag = gazania.fragment('VueFrag').on('User').select($ => $.select(['id']))
</script>
<script setup>
import { gazania } from 'gazania'
const VueSetupQuery = gazania.query('VueSetupQuery').select($ => $.select(['name']))
</script>`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{vue}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.fragments).toHaveProperty('VueFrag')
      expect(manifest.operations).toHaveProperty('VueSetupQuery')
    })

    it('extracts a query from a .svelte <script> block', async () => {
      await writeFileTest(
        join(dir, 'src', 'Comp.svelte'),
        `<script>
import { gazania } from 'gazania'
const SvelteQuery = gazania.query('SvelteQuery')
  .select($ => $.select(['id', 'name']))
</script>
<main><slot /></main>`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{ts,tsx,js,jsx,vue,svelte}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations).toHaveProperty('SvelteQuery')
      expect(manifest.operations.SvelteQuery.body).toContain('query SvelteQuery')
    })

    it('extracts from <script context="module"> in a .svelte file', async () => {
      await writeFileTest(
        join(dir, 'src', 'Comp.svelte'),
        `<script context="module">
import { gazania } from 'gazania'
export const SvelteModuleQuery = gazania.query('SvelteModuleQuery')
  .select($ => $.select(['id']))
</script>
<main />`,
      )

      await runExtract({
        dir: 'src',
        output: 'manifest.json',
        include: '**/*.{svelte}',
        algorithm: 'sha256',
        silent: true,
        cwd: dir,
      })

      const manifest = JSON.parse(await readFileTest(join(dir, 'manifest.json'), 'utf-8'))
      expect(manifest.operations).toHaveProperty('SvelteModuleQuery')
    })
  })
}
