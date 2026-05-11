import type { Program } from 'estree'
import type { VirtualFileEntry } from './ts-program'
import { parse, parseAndGenerateServices } from '@typescript-eslint/typescript-estree'
import { getScriptBlocks } from './preprocess'

export interface ParsedBlock {
  code: string
  ast: Program
  lineOffset: number
  nodeMap?: WeakMap<any, import('typescript').Node>
}

export interface ParseFileOptions {
  skipFilter?: boolean
  logger?: { debug: (...args: any[]) => void, warn: (...args: any[]) => void, error: (...args: any[]) => void }
}

export interface ParseFileContext {
  program?: import('typescript').Program
}

export function parseFile(filePath: string, options?: ParseFileOptions, host?: ExtractFS, context?: ParseFileContext): ParsedBlock[] | null {
  const rawCode = host?.readFile(filePath) ?? ''

  if (!options?.skipFilter && !rawCode.includes('.select(')) {
    return null
  }

  const isSFC = filePath.endsWith('.vue') || filePath.endsWith('.svelte')
  const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx')
  const program = context?.program

  let programSourceFile: import('typescript').SourceFile | undefined
  if (program && !isSFC) {
    programSourceFile = program.getSourceFile(filePath)
  }

  const scriptBlocks = getScriptBlocks(rawCode, filePath)
  const blocks: ParsedBlock[] = []

  for (const { code, lineOffset } of scriptBlocks) {
    if (!options?.skipFilter && !code.includes('.select(')) {
      continue
    }

    try {
      let ast: Program
      let nodeMap: WeakMap<any, import('typescript').Node> | undefined

      if (programSourceFile) {
        const result = parseAndGenerateServices(programSourceFile, { range: true, jsx: isJSX })
        ast = result.ast as unknown as Program
        nodeMap = result.services.esTreeNodeToTSNodeMap as WeakMap<any, import('typescript').Node>
      }
      else if (isSFC && program) {
        ast = parse(code, {
          range: true,
          filePath: 'block.ts',
          jsx: isJSX,
        }) as unknown as Program
        const virtualSF = program.getSourceFile(`${filePath}.ts`)
        if (virtualSF) {
          try {
            const virtualResult = parseAndGenerateServices(virtualSF, { range: true, jsx: isJSX })
            nodeMap = buildProxyNodeMap(
              ast,
              virtualResult.ast as unknown as Program,
              virtualResult.services.esTreeNodeToTSNodeMap as WeakMap<any, import('typescript').Node>,
            )
          }
          catch {
            // nodeMap stays undefined
          }
        }
      }
      else {
        const parseFilename = isSFC ? 'block.ts' : filePath.replace(/^.*[/\\]/, '')
        ast = parse(code, {
          range: true,
          filePath: parseFilename,
          jsx: isJSX,
        }) as unknown as Program
      }

      blocks.push({ code, ast, lineOffset, nodeMap })
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

type AnyEstreeNode = Record<string, any>

function buildProxyNodeMap(
  originalAst: Program,
  virtualAst: Program,
  virtualNodeMap: WeakMap<AnyEstreeNode, import('typescript').Node>,
): WeakMap<AnyEstreeNode, import('typescript').Node> {
  const virtualNodeIndex = buildNodeIndex(virtualAst)

  const proxyMap = new WeakMap<AnyEstreeNode, import('typescript').Node>()
  linkOriginalToVirtual(originalAst, virtualNodeIndex, proxyMap, virtualNodeMap)
  return proxyMap
}

type NodeKey = string

function nodeKey(node: AnyEstreeNode): NodeKey {
  if (node.type === 'Identifier') return `I:${node.name}`
  if (node.type === 'Literal') return `L:${JSON.stringify(node.value)}`
  if (node.type === 'MemberExpression' && node.property?.type === 'Identifier') {
    return `M:${node.property.name}`
  }
  return node.type
}

function buildNodeIndex(ast: AnyEstreeNode): Map<NodeKey, AnyEstreeNode[]> {
  const index = new Map<NodeKey, AnyEstreeNode[]>()
  function walk(node: AnyEstreeNode) {
    if (!node || typeof node !== 'object') return
    if (node.range) {
      const key = nodeKey(node)
      let arr = index.get(key)
      if (!arr) { arr = []; index.set(key, arr) }
      arr.push(node)
    }
    for (const k of Object.keys(node)) {
      if (k === 'parent' || k === 'loc') continue
      const val = node[k]
      if (Array.isArray(val)) val.forEach(walk)
      else if (val && typeof val === 'object' && val.type) walk(val)
    }
  }
  walk(ast)
  return index
}

function linkOriginalToVirtual(
  orig: AnyEstreeNode,
  virtualIndex: Map<NodeKey, AnyEstreeNode[]>,
  proxyMap: WeakMap<AnyEstreeNode, import('typescript').Node>,
  virtualNodeMap: WeakMap<AnyEstreeNode, import('typescript').Node>,
  usedVirtual = new Set<AnyEstreeNode>(),
): void {
  if (!orig || typeof orig !== 'object') return

  const key = nodeKey(orig)
  const candidates = virtualIndex.get(key)
  if (candidates) {
    for (const vNode of candidates) {
      if (!usedVirtual.has(vNode)) {
        const tsNode = virtualNodeMap.get(vNode)
        if (tsNode) {
          proxyMap.set(orig, tsNode)
          usedVirtual.add(vNode)
          break
        }
      }
    }
  }

  for (const k of Object.keys(orig)) {
    if (k === 'parent' || k === 'loc') continue
    const val = orig[k]
    if (Array.isArray(val)) val.forEach(v => linkOriginalToVirtual(v, virtualIndex, proxyMap, virtualNodeMap, usedVirtual))
    else if (val && typeof val === 'object' && val.type) linkOriginalToVirtual(val, virtualIndex, proxyMap, virtualNodeMap, usedVirtual)
  }
}
