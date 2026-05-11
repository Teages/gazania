import type { Program } from 'estree'
import type { ExtractFS } from './ts-program'
import { parse } from '@typescript-eslint/typescript-estree'
import { getScriptBlocks } from './preprocess'

export interface ParsedBlock {
  code: string
  ast: Program
  lineOffset: number
}

export interface ParseFileOptions {
  skipFilter?: boolean
  logger?: { debug: (...args: any[]) => void, warn: (...args: any[]) => void, error: (...args: any[]) => void }
}

/**
 * Parse a file into one or more code blocks with their ASTs.
 * Handles Vue/Svelte SFCs and TypeScript stripping.
 *
 * Returns `null` if the file does not contain a `.select(` call or no blocks parse.
 */
export function parseFile(filePath: string, options?: ParseFileOptions, host?: ExtractFS): ParsedBlock[] | null {
  const rawCode = host?.readFile(filePath) ?? ''

  if (!options?.skipFilter && !rawCode.includes('.select(')) {
    return null
  }

  const scriptBlocks = getScriptBlocks(rawCode, filePath)
  const blocks: ParsedBlock[] = []

  for (const { code, lineOffset } of scriptBlocks) {
    if (!options?.skipFilter && !code.includes('.select(')) {
      continue
    }

    const isSFC = filePath.endsWith('.vue') || filePath.endsWith('.svelte')
    const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx')

    try {
      // Determine a filename hint for language detection.
      // SFC script blocks use .ts; other files keep their original extension.
      const parseFilename = isSFC ? 'block.ts' : filePath.replace(/^.*[/\\]/, '')
      const ast = parse(code, {
        range: true,
        filePath: parseFilename,
        jsx: isJSX,
      })

      blocks.push({ code, ast: ast as unknown as Program, lineOffset })
    }
    catch {
      debugLog(filePath, lineOffset, 'parse failed', options)
      continue
    }
  }

  return blocks.length > 0 ? blocks : null
}

function debugLog(filePath: string, line: number, reason: string, options?: ParseFileOptions): void {
  options?.logger?.debug(`[gazania:extract] ${filePath}:${line} ${reason}`)
}

export function findFiles(dir: string, pattern: string, host: ExtractFS): string[] {
  const extensions = parseExtensions(pattern)
  return host.readDirectory(dir, Array.from(extensions), ['node_modules', '.git'], [] as readonly string[])
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
