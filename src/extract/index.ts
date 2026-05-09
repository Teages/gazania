import type { Program } from 'estree'
import type { DocumentNode } from 'graphql'
import { createHash, getHashes } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { cwd as getCwd } from 'node:process'
import { print } from 'graphql'
import { parseSync } from 'oxc-parser'
import { transformSync } from 'oxc-transform'
import { processFileStatic, staticExtractCrossFile } from './static/partial-resolver'

export interface ManifestEntry {
  body: string
  hash: string
}

export interface ExtractManifest {
  operations: Record<string, ManifestEntry>
  fragments: Record<string, ManifestEntry>
}

export interface SkippedExtraction {
  /** Absolute path of the file containing the skipped call */
  file: string
  /** 1-based line number in the original source file */
  line: number
  /** Error message from the failed evaluation */
  reason: string
}

export interface ExtractResult {
  manifest: ExtractManifest
  /** Gazania calls that were detected but could not be statically evaluated */
  skipped: SkippedExtraction[]
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
  /**
   * Path to tsconfig.json for cross-file partial/section resolution.
   * When provided, TypeScript module resolution is used to trace imports
   * of partials and sections across files, enabling extraction of operations
   * that reference partials defined in other files.
   *
   * Requires `typescript` to be installed as a dev dependency.
   */
  tsconfig?: string
}

/**
 * Scan source files for Gazania operations and return a persisted-query manifest.
 *
 * When `tsconfig` is provided, cross-file partial/section resolution is enabled:
 * files are processed in dependency order and partial definitions are propagated
 * between files via static AST analysis.
 *
 * @example
 * ```ts
 * import { extract } from 'gazania/extract'
 *
 * const { manifest } = await extract({ dir: 'src' })
 *
 * // With cross-file partial support:
 * const { manifest } = await extract({ dir: 'src', tsconfig: 'tsconfig.json' })
 * ```
 */
export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  const {
    dir,
    include = '**/*.{ts,tsx,js,jsx,vue,svelte}',
    algorithm = 'sha256',
    cwd = getCwd(),
    tsconfig,
  } = options

  const scanDir = join(cwd, dir)
  const files = await findFiles(scanDir, include)

  if (tsconfig) {
    return extractWithCrossFileResolution(files, algorithm, join(cwd, tsconfig))
  }

  return extractPerFile(files, algorithm)
}

/**
 * Original per-file extraction (no cross-file resolution).
 * Same-file partials/sections are still supported.
 */
async function extractPerFile(
  files: string[],
  algorithm: string,
): Promise<ExtractResult> {
  const manifest: ExtractManifest = {
    operations: {},
    fragments: {},
  }
  const allSkipped: SkippedExtraction[] = []

  for (const file of files) {
    const { documents, skipped } = await extractFromFile(file)
    for (const doc of documents) {
      addDocumentToManifest(manifest, doc, algorithm)
    }
    allSkipped.push(...skipped)
  }

  return { manifest, skipped: allSkipped }
}

/**
 * Cross-file extraction using TypeScript module resolution.
 * Files are processed in dependency order so that partials defined in one file
 * are available when analyzing operations in other files.
 */
async function extractWithCrossFileResolution(
  files: string[],
  algorithm: string,
  tsconfigPath: string,
): Promise<ExtractResult> {
  return staticExtractCrossFile(files, { tsconfigPath, algorithm })
}

interface ParsedBlock {
  code: string
  ast: Program
  /** Line offset of this block within the original source file (see ScriptBlock.lineOffset) */
  lineOffset: number
}

interface ParsedFileBlocks {
  blocks: ParsedBlock[]
}

/**
 * Parse a file into one or more code blocks with their ASTs.
 * Handles Vue/Svelte SFCs and TypeScript stripping.
 */
async function parseFile(filePath: string): Promise<ParsedFileBlocks | null> {
  const rawCode = await readFile(filePath, 'utf-8')

  if (!rawCode.includes('gazania')) {
    return null
  }

  const { getScriptBlocks } = await import('./preprocess')

  const scriptBlocks = getScriptBlocks(rawCode, filePath)
  const blocks: ParsedBlock[] = []

  for (const { code, lineOffset } of scriptBlocks) {
    if (!code.includes('gazania')) {
      continue
    }

    let evalCode = code
    const isSFC = filePath.endsWith('.vue') || filePath.endsWith('.svelte')

    try {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || isSFC) {
        const tsBasename = isSFC ? 'block.ts' : basename(filePath)
        const transformed = transformSync(tsBasename, code)
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

      blocks.push({ code: evalCode, ast: parseResult.program as unknown as Program, lineOffset })
    }
    catch {
      continue
    }
  }

  return blocks.length > 0 ? { blocks } : null
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

async function extractFromFile(filePath: string): Promise<{ documents: DocumentNode[], skipped: SkippedExtraction[] }> {
  const parsed = await parseFile(filePath)
  if (!parsed) {
    return { documents: [], skipped: [] }
  }

  const result = processFileStatic(
    parsed.blocks,
    filePath,
    new Map(),
    [],
  )

  return { documents: result.documents, skipped: result.skipped }
}

function addDocumentToManifest(
  manifest: ExtractManifest,
  doc: DocumentNode,
  algorithm: string,
): void {
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

function computeHash(body: string, algorithm: string): string {
  if (!getHashes().includes(algorithm)) {
    throw new Error(
      `Unsupported hash algorithm: "${algorithm}". `
      + `Supported algorithms: ${getHashes().join(', ')}`,
    )
  }
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
      const { manifest } = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toEqual({})
      expect(manifest.fragments).toEqual({})
    })

    it('extracts a simple query from a JS file', async () => {
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const doc = gazania.query('TestQuery').select($ => $.select(['id', 'name']))`,
      )
      const { manifest } = await extract({ dir: 'src', cwd: dir })
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
      const { manifest } = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('CreateUser')
      expect(manifest.operations.CreateUser.body).toContain('mutation CreateUser')
    })

    it('extracts a fragment', async () => {
      await writeFile(
        join(dir, 'src', 'fragment.js'),
        `import { gazania } from 'gazania'
const doc = gazania.fragment('UserFields').on('User').select($ => $.select(['id', 'name']))`,
      )
      const { manifest } = await extract({ dir: 'src', cwd: dir })
      expect(manifest.fragments).toHaveProperty('UserFields')
      expect(manifest.fragments.UserFields.body).toContain('fragment UserFields on User')
    })

    it('extracts multiple queries from multiple files', async () => {
      await writeFile(join(dir, 'src', 'a.js'), `import { gazania } from 'gazania'\nconst doc = gazania.query('QueryA').select($ => $.select(['fieldA']))`)
      await writeFile(join(dir, 'src', 'b.js'), `import { gazania } from 'gazania'\nconst doc = gazania.query('QueryB').select($ => $.select(['fieldB']))`)
      const { manifest } = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('QueryA')
      expect(manifest.operations).toHaveProperty('QueryB')
    })

    it('handles files that cannot be parsed', async () => {
      await writeFile(join(dir, 'src', 'broken.js'), `this is not valid javascript {{{`)
      const { manifest } = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toEqual({})
    })

    it('supports different hash algorithms', async () => {
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('TestQuery').select($ => $.select(['id']))`,
      )
      const { manifest } = await extract({ dir: 'src', algorithm: 'md5', cwd: dir })
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
      const { manifest } = await extract({ dir: 'src', include: '**/*.{vue}', cwd: dir })
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
      const { manifest } = await extract({ dir: 'src', include: '**/*.{vue}', cwd: dir })
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
      const { manifest } = await extract({ dir: 'src', include: '**/*.{svelte}', cwd: dir })
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
      const { manifest } = await extract({ dir: 'src', cwd: dir })
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
      const { manifest } = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('TsxQuery')
    })

    it('extracts a query that uses a same-file partial', async () => {
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
      )
      const { manifest } = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('GetUser')
      expect(manifest.operations.GetUser.body).toContain('...UserFields')
      expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
    })

    it('extracts a query that uses a same-file section', async () => {
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const userSection = gazania.section('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userSection({}),
    ]),
  }]))`,
      )
      const { manifest } = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('GetUser')
      expect(manifest.operations.GetUser.body).toContain('...UserFields')
    })

    it('extracts a query using multiple same-file partials', async () => {
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const namePartial = gazania.partial('UserName')
  .on('User')
  .select($ => $.select(['name']))
const emailPartial = gazania.partial('UserEmail')
  .on('User')
  .select($ => $.select(['email']))
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...namePartial({}),
      ...emailPartial({}),
    ]),
  }]))`,
      )
      const { manifest } = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).toHaveProperty('GetUser')
      expect(manifest.operations.GetUser.body).toContain('...UserName')
      expect(manifest.operations.GetUser.body).toContain('...UserEmail')
    })
  })

  describe('extract with tsconfig (cross-file)', () => {
    let dir: string

    beforeEach(async () => {
      dir = join(tmpdir(), `gazania-crossfile-test-${Date.now()}`)
      await mkdir(dir, { recursive: true })
      await mkdir(join(dir, 'src'), { recursive: true })
      await mkdir(join(dir, 'src', 'fragments'), { recursive: true })

      // Create a minimal tsconfig.json
      await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'esnext',
          module: 'esnext',
          moduleResolution: 'bundler',
          strict: true,
        },
        include: ['src'],
      }))
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
    })

    it('extracts a query that uses a cross-file partial', async () => {
      // Partial defined in a separate file
      await writeFile(
        join(dir, 'src', 'fragments', 'user.js'),
        `import { gazania } from 'gazania'
export const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
      )

      // Query that imports and uses the partial
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
import { userPartial } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
      )

      const { manifest } = await extract({
        dir: 'src',
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(manifest.operations).toHaveProperty('GetUser')
      expect(manifest.operations.GetUser.body).toContain('...UserFields')
      expect(manifest.operations.GetUser.body).toContain('fragment UserFields on User')
    })

    it('extracts a query that uses a cross-file section', async () => {
      await writeFile(
        join(dir, 'src', 'fragments', 'user.js'),
        `import { gazania } from 'gazania'
export const userSection = gazania.section('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
      )

      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
import { userSection } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userSection({}),
    ]),
  }]))`,
      )

      const { manifest } = await extract({
        dir: 'src',
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(manifest.operations).toHaveProperty('GetUser')
      expect(manifest.operations.GetUser.body).toContain('...UserFields')
    })

    it('extracts with multiple cross-file partials from different files', async () => {
      await writeFile(
        join(dir, 'src', 'fragments', 'name.js'),
        `import { gazania } from 'gazania'
export const namePartial = gazania.partial('UserName')
  .on('User')
  .select($ => $.select(['name']))`,
      )

      await writeFile(
        join(dir, 'src', 'fragments', 'email.js'),
        `import { gazania } from 'gazania'
export const emailPartial = gazania.partial('UserEmail')
  .on('User')
  .select($ => $.select(['email']))`,
      )

      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
import { namePartial } from './fragments/name'
import { emailPartial } from './fragments/email'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...namePartial({}),
      ...emailPartial({}),
    ]),
  }]))`,
      )

      const { manifest } = await extract({
        dir: 'src',
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(manifest.operations).toHaveProperty('GetUser')
      expect(manifest.operations.GetUser.body).toContain('...UserName')
      expect(manifest.operations.GetUser.body).toContain('...UserEmail')
    })

    it('handles re-exported partials with alias', async () => {
      await writeFile(
        join(dir, 'src', 'fragments', 'user.js'),
        `import { gazania } from 'gazania'
const _userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))
export { _userPartial as userPartial }`,
      )

      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
import { userPartial } from './fragments/user'
const doc = gazania.query('GetUser')
  .select($ => $.select([{
    user: $ => $.select([
      ...userPartial({}),
    ]),
  }]))`,
      )

      const { manifest } = await extract({
        dir: 'src',
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(manifest.operations).toHaveProperty('GetUser')
      expect(manifest.operations.GetUser.body).toContain('...UserFields')
    })

    it('still extracts simple queries without cross-file dependencies', async () => {
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'
const doc = gazania.query('SimpleQuery').select($ => $.select(['id']))`,
      )

      const { manifest } = await extract({
        dir: 'src',
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(manifest.operations).toHaveProperty('SimpleQuery')
    })

    it('extracts operations that use cross-file partials when a circular dependency exists', async () => {
      // Regression: index.ts exports the builder AND imports partials from fragments.ts,
      // while fragments.ts imports the builder from index.ts — a circular dependency.
      // The topological sort may process index.ts before fragments.ts, leaving partials
      // unresolved on the first pass. A second pass is required to resolve the query.
      await writeFile(
        join(dir, 'src', 'index.ts'),
        `import { createGazania } from 'gazania'
import { userPartial } from './fragments'
export const gazania = createGazania('https://example.com/graphql')
export const GetUsersWithFragment = gazania.query('GetUsersWithFragment')
  .select($ => $.select([{
    users: $ => $.select([...userPartial({})]),
  }]))`,
      )
      await writeFile(
        join(dir, 'src', 'fragments.ts'),
        `import { gazania } from './index'
export const userPartial = gazania.partial('UserFields')
  .on('User')
  .select($ => $.select(['id', 'name']))`,
      )

      const { manifest } = await extract({
        dir: 'src',
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(manifest.operations).toHaveProperty('GetUsersWithFragment')
      expect(manifest.operations.GetUsersWithFragment!.body).toContain('...UserFields')
      expect(manifest.operations.GetUsersWithFragment!.body).toContain('fragment UserFields on User')
    })

    it('extracts operations from framework files (Vue/Svelte/React) that import gazania from a local module', async () => {
      // Regression: Vue/Svelte/React files import `gazania` from a local module
      // (e.g. `import { gazania } from './index'`) rather than from 'gazania'.
      // Previously these files were skipped because the static analysis
      // returned early when no `import from 'gazania'` was present.
      await writeFile(
        join(dir, 'src', 'index.ts'),
        `import { createGazania } from 'gazania'
export const gazania = createGazania('https://example.com/graphql')`,
      )
      await writeFile(
        join(dir, 'src', 'App.vue'),
        `<script setup lang="ts">
import { gazania } from './index'
const VueQuery = gazania.query('GetUsers_Vue').select($ => $.select(['id', 'name']))
</script>
<template><div /></template>`,
      )
      await writeFile(
        join(dir, 'src', 'App.svelte'),
        `<script lang="ts">
import { gazania } from './index'
const SvelteQuery = gazania.query('GetUsers_Svelte').select($ => $.select(['id', 'name']))
</script>
<main />`,
      )
      await writeFile(
        join(dir, 'src', 'react.tsx'),
        `import { gazania } from './index'
const ReactQuery = gazania.query('GetUsers_React').select($ => $.select(['id', 'name']))`,
      )

      const { manifest } = await extract({
        dir: 'src',
        cwd: dir,
        tsconfig: 'tsconfig.json',
      })

      expect(manifest.operations).toHaveProperty('GetUsers_Vue')
      expect(manifest.operations).toHaveProperty('GetUsers_Svelte')
      expect(manifest.operations).toHaveProperty('GetUsers_React')
    })
  })

  describe('extract: skipped calls', () => {
    let dir: string

    beforeEach(async () => {
      dir = join(tmpdir(), `gazania-skipped-test-${Date.now()}`)
      await mkdir(dir, { recursive: true })
      await mkdir(join(dir, 'src'), { recursive: true })
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
    })

    it('returns empty skipped array when all calls succeed', async () => {
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('OkQuery').select($ => $.select(['id']))`,
      )
      const { skipped } = await extract({ dir: 'src', cwd: dir })
      expect(skipped).toHaveLength(0)
    })

    it('returns a skipped entry when a call references an undefined variable', async () => {
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('FailQuery').select($ => $.select([...missingPartial({})]))`,
      )
      const { manifest, skipped } = await extract({ dir: 'src', cwd: dir })
      expect(manifest.operations).not.toHaveProperty('FailQuery')
      expect(skipped).toHaveLength(1)
      expect(skipped[0]!.reason).toMatch(/missingPartial is not defined/)
    })

    it('skipped entry includes the absolute file path', async () => {
      const { join: pathJoin } = await import('node:path')
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\nconst doc = gazania.query('X').select($ => $.select([...gone({})]))`,
      )
      const { skipped } = await extract({ dir: 'src', cwd: dir })
      expect(skipped).toHaveLength(1)
      expect(skipped[0]!.file).toBe(pathJoin(dir, 'src', 'query.js'))
    })

    it('skipped entry has a 1-based line number pointing to the failing call', async () => {
      // Line 1: import
      // Line 2: blank
      // Line 3: the failing query (line 3)
      await writeFile(
        join(dir, 'src', 'query.js'),
        `import { gazania } from 'gazania'\n\nconst doc = gazania.query('LineTest').select($ => $.select([...gone({})]))`,
      )
      const { skipped } = await extract({ dir: 'src', cwd: dir })
      expect(skipped).toHaveLength(1)
      expect(skipped[0]!.line).toBe(3)
    })

    it('skipped entry line number accounts for SFC lineOffset in Vue files', async () => {
      // File layout (0-indexed from line 1):
      //   Line 1: <template><div/></template>
      //   Line 2: <script setup>
      //   Line 3: import { gazania } from 'gazania'
      //   Line 4: const doc = gazania.query(...)   ← expected line
      const vue = `<template><div/></template>\n<script setup>\nimport { gazania } from 'gazania'\nconst doc = gazania.query('VueFail').select($ => $.select([...gone({})]))\n</script>`
      await writeFile(join(dir, 'src', 'Comp.vue'), vue)
      const { skipped } = await extract({ dir: 'src', cwd: dir })
      expect(skipped).toHaveLength(1)
      expect(skipped[0]!.line).toBe(4)
    })

    it('collects skipped calls from multiple files', async () => {
      await writeFile(
        join(dir, 'src', 'a.js'),
        `import { gazania } from 'gazania'\nconst d = gazania.query('A').select($ => $.select([...x({})]))`,
      )
      await writeFile(
        join(dir, 'src', 'b.js'),
        `import { gazania } from 'gazania'\nconst d = gazania.query('B').select($ => $.select([...y({})]))`,
      )
      const { skipped } = await extract({ dir: 'src', cwd: dir })
      expect(skipped).toHaveLength(2)
      const files = skipped.map(s => s.file)
      expect(files.some(f => f.endsWith('a.js'))).toBe(true)
      expect(files.some(f => f.endsWith('b.js'))).toBe(true)
    })

    it('cross-file mode: skipped when imported file is outside the scanned directory', async () => {
      // The fragments file is outside the `src/` scan root, so it is not
      // collected by findFiles and therefore not available as a known file.
      // Because the import cannot be resolved to a known file, the binding
      // never appears in the cross-file bindings and the query fails to evaluate.
      await mkdir(join(dir, 'fragments'), { recursive: true })
      await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'esnext', moduleResolution: 'bundler' },
        include: ['src', 'fragments'],
      }))
      await writeFile(
        join(dir, 'fragments', 'user.ts'),
        `import { gazania } from 'gazania'\nexport const myPartial = gazania.partial('User').on('User').select($ => $.select(['id']))`,
      )
      // query.ts imports from outside the scanned src/ directory
      await writeFile(
        join(dir, 'src', 'query.ts'),
        `import { myPartial } from '../fragments/user'\nimport { gazania } from 'gazania'\nconst doc = gazania.query('GetUser').select($ => $.select([...myPartial({})]))`,
      )
      const { manifest, skipped } = await extract({ dir: 'src', cwd: dir, tsconfig: 'tsconfig.json' })
      expect(manifest.operations).not.toHaveProperty('GetUser')
      expect(skipped).toHaveLength(1)
      expect(skipped[0]!.reason).toMatch(/myPartial is not defined/)
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
