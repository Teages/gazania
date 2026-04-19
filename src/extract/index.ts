import type { DocumentNode } from 'graphql'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd as getCwd } from 'node:process'
import { print } from 'graphql'
import { parseSync } from 'oxc-parser'
import { transformSync } from 'oxc-transform'

export interface ManifestEntry {
  body: string
  hash: string
}

export interface ExtractManifest {
  operations: Record<string, ManifestEntry>
  fragments: Record<string, ManifestEntry>
}

export interface ExtractOptions {
  /** Directory to scan for source files. */
  dir: string
  /** Glob pattern for files to include. Defaults to `"**\/*.{ts,tsx,js,jsx,vue,svelte}"`. */
  include?: string
  /** Hash algorithm. Defaults to `"sha256"`. */
  algorithm?: string
  /** Working directory used to resolve `dir`. Defaults to `process.cwd()`. */
  cwd?: string
}

/**
 * Scan source files for Gazania operations and return a persisted-query manifest.
 *
 * @example
 * ```ts
 * import { extract } from 'gazania/extract'
 *
 * const manifest = await extract({ dir: 'src' })
 * ```
 */
export async function extract(options: ExtractOptions): Promise<ExtractManifest> {
  const {
    dir,
    include = '**/*.{ts,tsx,js,jsx,vue,svelte}',
    algorithm = 'sha256',
    cwd = getCwd(),
  } = options

  const scanDir = join(cwd, dir)
  const files = await findFiles(scanDir, include)

  const manifest: ExtractManifest = {
    operations: {},
    fragments: {},
  }

  for (const file of files) {
    const documents = await extractFromFile(file)
    for (const doc of documents) {
      const body = print(doc)
      const hash = computeHash(body, algorithm)
      const { name, type } = getOperationName(doc)

      if (!name) {
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
    }
  }

  return manifest
}

async function findFiles(dir: string, pattern: string): Promise<string[]> {
  const extensions = parseExtensions(pattern)
  const results: string[] = []
  await walkDir(dir, extensions, results)
  return results
}

function parseExtensions(pattern: string): Set<string> {
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

async function extractFromFile(filePath: string): Promise<DocumentNode[]> {
  const rawCode = await readFile(filePath, 'utf-8')

  if (!rawCode.includes('gazania')) {
    return []
  }

  const { getScriptBlocks } = await import('../cli/preprocess')
  const { evaluateGazaniaExpressions } = await import('../cli/evaluate')

  const blocks = getScriptBlocks(rawCode, filePath)
  const documents: DocumentNode[] = []

  for (const code of blocks) {
    if (!code.includes('gazania')) {
      continue
    }

    let evalCode = code
    let ast: object
    const isSFC = filePath.endsWith('.vue') || filePath.endsWith('.svelte')

    try {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || isSFC) {
        const basename = isSFC ? 'block.ts' : filePath.slice(filePath.lastIndexOf('/') + 1)
        const transformed = transformSync(basename, code)
        if (transformed.errors.length > 0) {
          continue
        }
        evalCode = transformed.code
      }

      const parseFilename = filePath.endsWith('.jsx') ? 'eval.jsx' : 'eval.js'
      const parseResult = parseSync(parseFilename, evalCode)
      if (parseResult.errors.length > 0) {
        continue
      }
      ast = parseResult.program
    }
    catch {
      continue
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

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach, afterEach } = import.meta.vitest
  // eslint-disable-next-line antfu/no-top-level-await
  const { mkdir, rm, writeFile } = await import('node:fs/promises')
  // eslint-disable-next-line antfu/no-top-level-await
  const { tmpdir } = await import('node:os')

  describe('extract', () => {
    let dir: string

    beforeEach(async () => {
      dir = join(tmpdir(), `gazania-extract-test-${Date.now()}`)
      await mkdir(dir, { recursive: true })
      await mkdir(join(dir, 'src'), { recursive: true })
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
    })

    it('returns an empty manifest when no gazania files found', async () => {
      await writeFile(join(dir, 'src', 'index.js'), `const x = 1`)
      const manifest = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toEqual({})
      expect(manifest.fragments).toEqual({})
    })

    it('extracts a simple query from a JS file', async () => {
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const doc = gazania.query('TestQuery').select($ => $.select(['id', 'name']))`,
      )
      const manifest = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('TestQuery')
      expect(manifest.operations.TestQuery.body).toContain('query TestQuery')
      expect(manifest.operations.TestQuery.hash).toMatch(/^sha256:/)
    })

    it('extracts a mutation', async () => {
      await writeFile(
        join(dir, 'src', 'mutation.js'),
        `import { gazania } from 'gazania'
const doc = gazania.mutation('CreateUser')
  .vars({ input: 'CreateUserInput!' })
  .select(($, vars) => $.select([{ createUser: $ => $.args({ input: vars.input }).select(['id']) }]))`,
      )
      const manifest = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('CreateUser')
      expect(manifest.operations.CreateUser.body).toContain('mutation CreateUser')
    })

    it('extracts a fragment', async () => {
      await writeFile(
        join(dir, 'src', 'fragment.js'),
        `import { gazania } from 'gazania'
const doc = gazania.fragment('UserFields').on('User').select($ => $.select(['id', 'name']))`,
      )
      const manifest = await extract({ dir: 'src', cwd: dir })
      expect(manifest.fragments).toHaveProperty('UserFields')
      expect(manifest.fragments.UserFields.body).toContain('fragment UserFields on User')
    })

    it('extracts multiple queries from multiple files', async () => {
      await writeFile(join(dir, 'src', 'a.js'), `import { gazania } from 'gazania'\nconst doc = gazania.query('QueryA').select($ => $.select(['fieldA']))`)
      await writeFile(join(dir, 'src', 'b.js'), `import { gazania } from 'gazania'\nconst doc = gazania.query('QueryB').select($ => $.select(['fieldB']))`)
      const manifest = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('QueryA')
      expect(manifest.operations).toHaveProperty('QueryB')
    })

    it('handles files that cannot be parsed', async () => {
      await writeFile(join(dir, 'src', 'broken.js'), `this is not valid javascript {{{`)
      const manifest = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toEqual({})
    })

    it('supports different hash algorithms', async () => {
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('TestQuery').select($ => $.select(['id']))`,
      )
      const manifest = await extract({ dir: 'src', algorithm: 'md5', cwd: dir })
      expect(manifest.operations.TestQuery.hash).toMatch(/^md5:/)
    })

    it('extracts a query from a .vue <script setup> block', async () => {
      await writeFile(
        join(dir, 'src', 'Comp.vue'),
        `<template><div/></template>
<script setup>
import { gazania } from 'gazania'
const VueQuery = gazania.query('VueQuery').select($ => $.select(['id']))
</script>`,
      )
      const manifest = await extract({ dir: 'src', include: '**/*.{vue}', cwd: dir })
      expect(manifest.operations).toHaveProperty('VueQuery')
    })

    it('extracts queries from both <script> and <script setup> in a .vue file', async () => {
      await writeFile(
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
      const manifest = await extract({ dir: 'src', include: '**/*.{vue}', cwd: dir })
      expect(manifest.fragments).toHaveProperty('VueFrag')
      expect(manifest.operations).toHaveProperty('VueSetupQuery')
    })

    it('extracts a query from a .svelte <script> block', async () => {
      await writeFile(
        join(dir, 'src', 'Comp.svelte'),
        `<script>
import { gazania } from 'gazania'
const SvelteQuery = gazania.query('SvelteQuery').select($ => $.select(['id']))
</script>
<main />`,
      )
      const manifest = await extract({ dir: 'src', include: '**/*.{svelte}', cwd: dir })
      expect(manifest.operations).toHaveProperty('SvelteQuery')
    })

    it('extracts a query from a .ts file with type annotations', async () => {
      await writeFile(
        join(dir, 'src', 'query.ts'),
        `import { createGazania } from 'gazania'
const API: string = 'https://api.example.com/graphql'
const gazania = createGazania(API)
const TypedQuery = gazania.query('TypedQuery').select($ => $.select(['id']))`,
      )
      const manifest = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('TypedQuery')
    })

    it('extracts a query from a .tsx file with JSX and TypeScript types', async () => {
      await writeFile(
        join(dir, 'src', 'App.tsx'),
        `import { createGazania } from 'gazania'
const API = 'https://api.example.com/graphql'
const gazania = createGazania(API)
const TsxQuery = gazania.query('TsxQuery').select($ => $.select(['id']))
interface User { id: string }
function App() { return <div /> }`,
      )
      const manifest = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('TsxQuery')
    })
  })

  describe('oxc parsing', () => {
    it('parses plain JavaScript', async () => {
      const { parseSync } = await import('oxc-parser')
      const result = parseSync('test.js', `const x = 1`)
      expect(result.errors).toHaveLength(0)
      expect(result.program.type).toBe('Program')
    })

    it('parses JSX', async () => {
      const { parseSync } = await import('oxc-parser')
      const result = parseSync('test.jsx', `const App = () => <div>hello</div>`)
      expect(result.errors).toHaveLength(0)
      expect(result.program.type).toBe('Program')
    })

    it('parses TypeScript directly', async () => {
      const { parseSync } = await import('oxc-parser')
      const result = parseSync('test.ts', `const x: string = 'hello'`)
      expect(result.errors).toHaveLength(0)
      expect(result.program.type).toBe('Program')
    })

    it('parses TypeScript + JSX', async () => {
      const { parseSync } = await import('oxc-parser')
      const result = parseSync('test.tsx', `const x: string = 'hello'; const App = () => <div />`)
      expect(result.errors).toHaveLength(0)
      expect(result.program.type).toBe('Program')
    })
  })

  describe('oxc-transform', () => {
    it('strips TypeScript type annotations', async () => {
      const { transformSync } = await import('oxc-transform')
      const result = transformSync('test.ts', `const x: string = 'hello'\nfunction f(a: number): void {}`)
      expect(result.errors).toHaveLength(0)
      expect(result.code).not.toContain(': string')
      expect(result.code).not.toContain(': number')
      expect(result.code).toContain('hello')
    })

    it('handles TSX', async () => {
      const { transformSync } = await import('oxc-transform')
      const result = transformSync('test.tsx', `interface User { id: string }\nfunction App() { return <div /> }`)
      expect(result.errors).toHaveLength(0)
      expect(result.code).not.toContain('interface User')
      expect(result.code).not.toContain(': string')
    })
  })
}
