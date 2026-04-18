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
 * Supports patterns like `**\/*.{ts,tsx,js,jsx}`.
 */
async function findFiles(dir: string, pattern: string): Promise<string[]> {
  const extensions = extractExtensions(pattern)
  const results: string[] = []
  await walkDir(dir, extensions, results)
  return results
}

function extractExtensions(pattern: string): Set<string> {
  // Parse patterns like **/*.{ts,tsx,js,jsx} or **/*.ts
  const match = /\.\{([^}]+)\}$/.exec(pattern) || /\.(\w+)$/.exec(pattern)
  if (!match) {
    return new Set(['.ts', '.tsx', '.js', '.jsx'])
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
 * Uses the same sandboxed evaluation as the transform plugin.
 */
async function extractFromFile(filePath: string): Promise<DocumentNode[]> {
  const code = await readFile(filePath, 'utf-8')

  if (!code.includes('gazania')) {
    return []
  }

  // Use jiti for runtime TypeScript evaluation
  const { evaluateGazaniaExpressions } = await import('../transform/evaluate')

  let ast
  try {
    // Use acorn to parse
    const acorn = await import('acorn')
    ast = acorn.parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      // Allow import assertions / import attributes
      allowImportExpressions: true,
    })
  }
  catch {
    // If acorn can't parse (e.g. TypeScript), try stripping types first
    try {
      const stripped = await stripTypes(code)
      const acorn = await import('acorn')
      ast = acorn.parse(stripped, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        allowImportExpressions: true,
      })
    }
    catch {
      return []
    }
  }

  const results = evaluateGazaniaExpressions(code, ast as any)

  const documents: DocumentNode[] = []
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
        // Anonymous operations get a hash-based name
        const anonKey = `Anonymous_${hash.slice(hash.indexOf(':') + 1, hash.indexOf(':') + 9)}`
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
