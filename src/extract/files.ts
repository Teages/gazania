import type { Program } from 'estree'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parseSync } from 'oxc-parser'
import { transformSync } from 'oxc-transform'

export interface ParsedBlock {
  code: string
  ast: Program
  /** Line offset of this block within the original source file (see ScriptBlock.lineOffset) */
  lineOffset: number
}

/**
 * Parse a file into one or more code blocks with their ASTs.
 * Handles Vue/Svelte SFCs and TypeScript stripping.
 *
 * Returns `null` if the file does not reference `gazania`/`Gazania` or no blocks parse.
 */
export async function parseFile(filePath: string, options?: { skipFilter?: boolean }): Promise<ParsedBlock[] | null> {
  const rawCode = await readFile(filePath, 'utf-8')

  if (!options?.skipFilter && !rawCode.includes('gazania') && !rawCode.includes('Gazania')) {
    return null
  }

  const { getScriptBlocks } = await import('./preprocess')

  const scriptBlocks = getScriptBlocks(rawCode, filePath)
  const blocks: ParsedBlock[] = []

  for (const { code, lineOffset } of scriptBlocks) {
    if (!options?.skipFilter && !code.includes('gazania') && !code.includes('Gazania')) {
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

      const parseFilename = (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) ? 'eval.jsx' : 'eval.js'
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

  return blocks.length > 0 ? blocks : null
}

export async function findFiles(dir: string, pattern: string): Promise<string[]> {
  const extensions = parseExtensions(pattern)
  const results: string[] = []
  await walkDir(dir, extensions, results)
  return results
}

export function staticOffsetToLine(code: string, offset: number): number {
  return code.slice(0, offset).split('\n').length
}

export function offsetToLineColumn(code: string, offset: number): { line: number, column: number, offset: number } {
  const before = code.slice(0, offset)
  const line = before.split('\n').length
  const lastNewline = before.lastIndexOf('\n')
  const column = offset - lastNewline // 1-based since lastNewline is -1 when no newline
  return { line, column, offset }
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
