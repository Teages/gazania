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
    const isJSX = filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
    try {
      ast = await parseCode(code, isJSX)
    }
    catch {
      // If acorn can't parse (e.g. TypeScript/TSX), try stripping types first.
      try {
        evalCode = await stripTypes(code, filePath)
        ast = await parseCode(evalCode, isJSX)
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
 * Parse JavaScript/TypeScript source using acorn.
 * For JSX files (.tsx/.jsx), uses acorn-jsx plugin.
 */
async function parseCode(code: string, isJSX: boolean): Promise<object> {
  const acorn = await import('acorn')
  if (isJSX) {
    const acornJSX = (await import('acorn-jsx')).default
    const parser = acorn.Parser.extend(acornJSX())
    return parser.parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
    })
  }
  return acorn.parse(code, {
    sourceType: 'module',
    ecmaVersion: 'latest',
  })
}

/**
 * Strip TypeScript type annotations using Node.js built-in module.
 * Returns the original code if type stripping is not available.
 */
async function stripTypes(code: string, filePath?: string): Promise<string> {
  const mod = await import('node:module') as any

  // Node.js 22.12+ / 23.x+ exposes stripTypeScriptTypes
  if (typeof mod.stripTypeScriptTypes === 'function') {
    try {
      return mod.stripTypeScriptTypes(code, { mode: 'strip' }) as string
    }
    catch {
      // Fall through — may fail for JSX or unsupported syntax
    }
  }

  // Legacy Node.js 22.6+ API (renamed to stripTypeScriptTypes in later releases)
  if (typeof mod.transformSync === 'function') {
    try {
      const result = mod.transformSync(code, { mode: 'strip-only' })
      return typeof result === 'string' ? result : result.code
    }
    catch {
      // Fall through
    }
  }

  // Fallback: try TypeScript compiler (handles TSX/JSX + TypeScript).
  // TypeScript is typically available in projects that use .tsx files.
  try {
    const isJSX = filePath?.endsWith('.tsx') || filePath?.endsWith('.jsx')
    // TypeScript's CJS internals use __filename/__dirname which are unavailable
    // in pure ESM. Polyfill them on globalThis before importing.
    if (!('__filename' in globalThis)) {
      const { fileURLToPath } = await import('node:url')
      ;(globalThis as any).__filename = fileURLToPath(import.meta.url)
      ;(globalThis as any).__dirname = (globalThis as any).__filename.slice(
        0,
        (globalThis as any).__filename.lastIndexOf('/'),
      )
    }
    const ts = await import('typescript') as any
    const result = ts.transpileModule(code, {
      compilerOptions: {
        jsx: isJSX ? ts.JsxEmit?.React ?? 2 : undefined,
        module: ts.ModuleKind?.ESNext ?? 99,
      },
    })
    return result.outputText as string
  }
  catch {
    // TypeScript not available — return original code
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

    it('extracts a query from a .ts TypeScript file with type annotations', async () => {
      // Regression: type annotations must be stripped before acorn can parse
      await writeFileTest(
        join(dir, 'src', 'query.ts'),
        `import { createGazania } from 'gazania'
const API: string = 'https://api.example.com/graphql'
const gazania = createGazania(API)
const TypedQuery = gazania.query('TypedQuery')
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
      expect(manifest.operations).toHaveProperty('TypedQuery')
      expect(manifest.operations.TypedQuery.body).toContain('query TypedQuery')
    })

    it('extracts a query from a .tsx file with JSX and TypeScript types', async () => {
      // Regression: TSX requires acorn-jsx + TypeScript compiler fallback
      await writeFileTest(
        join(dir, 'src', 'App.tsx'),
        `import { createGazania } from 'gazania'
const API = 'https://api.example.com/graphql'
const gazania = createGazania(API)
const TsxQuery = gazania.query('TsxQuery')
  .select($ => $.select(['id', 'name']))
interface User { id: string; name: string }
function App(): JSX.Element {
  return <div>{TsxQuery.toString()}</div>
}`,
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
      expect(manifest.operations).toHaveProperty('TsxQuery')
      expect(manifest.operations.TsxQuery.body).toContain('query TsxQuery')
    })
  })

  describe('parseCode', () => {
    it('parses plain JavaScript', async () => {
      const code = `const x = 1`
      const ast = await parseCode(code, false)
      expect((ast as any).type).toBe('Program')
    })

    it('parses JSX when isJSX is true', async () => {
      const code = `const App = () => <div>hello</div>`
      const ast = await parseCode(code, true)
      expect((ast as any).type).toBe('Program')
    })

    it('throws on TypeScript syntax', async () => {
      const code = `const x: string = 'hello'`
      await expect(parseCode(code, false)).rejects.toThrow()
    })

    it('throws on TypeScript + JSX syntax (acorn-jsx does not understand TS)', async () => {
      const code = `const x: string = 'hello'; const App = () => <div />`
      await expect(parseCode(code, true)).rejects.toThrow()
    })
  })

  describe('stripTypes', () => {
    it('strips TypeScript type annotations', async () => {
      const code = `const x: string = 'hello'\nfunction f(a: number): void {}`
      const stripped = await stripTypes(code)
      // Types should be gone; identifiers/values must remain
      expect(stripped).not.toContain(': string')
      expect(stripped).not.toContain(': number')
      expect(stripped).not.toContain('): void')
      expect(stripped).toContain('\'hello\'')
    })

    it('handles TSX via the TypeScript compiler fallback', async () => {
      const code = `import { createGazania } from 'gazania'
const API: string = 'https://api.example.com/graphql'
const gazania = createGazania(API)
interface User { id: string }
function App(): JSX.Element { return <div /> }`
      const stripped = await stripTypes(code, 'test.tsx')
      // Type annotations and interface must be gone
      expect(stripped).not.toContain('interface User')
      expect(stripped).not.toContain(': string')
      expect(stripped).not.toContain(': JSX.Element')
      // Runtime code must remain
      expect(stripped).toContain('createGazania')
      expect(stripped).toContain('api.example.com')
    })
  })
}
