export interface ScriptBlock {
  code: string
  /**
   * Number of newlines in the original source file before the first character
   * of this block's content. Used to compute accurate 1-based line numbers:
   * `actualLine = lineInBlock + lineOffset`.
   *
   * Always `0` for non-SFC files.
   */
  lineOffset: number
}

/**
 * Extracts the JavaScript/TypeScript script content from framework-specific
 * single-file component (SFC) formats before passing to the evaluator.
 *
 * - `.vue`: extracts `<script>` and `<script setup>` blocks
 * - `.svelte`: extracts `<script>` and `<script context="module">` blocks
 * - others: returns a single block with `lineOffset: 0`
 *
 * Each block is returned as a separate entry so duplicate imports across
 * blocks (common in Vue SFCs) do not cause parse errors.
 */
export function getScriptBlocks(code: string, filePath: string): ScriptBlock[] {
  if (!/\.[jt]sx?$/.test(filePath)) {
    return extractSFCScriptBlocks(code)
  }
  return [{ code, lineOffset: 0 }]
}

/**
 * Regex-based `<script>` block extractor.
 *
 * A new RegExp instance is created on every call to avoid shared `lastIndex`
 * state across calls. The regex is intentionally simple — it stops at the
 * first `</script>` after the opening tag, which is the standard approach
 * used by Vite's Vue plugin and other ecosystem tools.
 */
function extractSFCScriptBlocks(code: string): ScriptBlock[] {
  const re = /<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi
  const blocks: ScriptBlock[] = []
  let match: RegExpExecArray | null

  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(code)) !== null) {
    const full = match[0]!
    const matchStart = match.index
    const openTagEnd = full.indexOf('>') + 1
    const closeTagStart = full.lastIndexOf('</script>')
    if (openTagEnd > 0 && closeTagStart > openTagEnd) {
      let content = full.slice(openTagEnd, closeTagStart)
      if (content.trim()) {
        // Count newlines in the original source file before this block's content.
        // This lets callers compute accurate 1-based line numbers:
        //   actualLine = lineWithinBlock + lineOffset
        //
        // Strip ALL leading newlines from content and fold them into lineOffset
        // before the block reaches OXC. This ensures block.code begins on the
        // first actual content line, so the line arithmetic is independent of
        // how many blank lines the author put after the opening tag and of any
        // incidental normalisation OXC might apply to leading blank lines.
        const absoluteContentStart = matchStart + openTagEnd
        const baseLines = code.slice(0, absoluteContentStart).split('\n').length - 1
        const leadingNewlines = /^\n*/.exec(content)![0].length
        content = content.slice(leadingNewlines)
        const lineOffset = baseLines + leadingNewlines
        if (content.trim()) {
          blocks.push({ code: content, lineOffset })
        }
      }
    }
  }

  return blocks
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('getScriptBlocks', () => {
    it('returns the raw code as a single block for .ts files', () => {
      const code = `import { gazania } from 'gazania'\nconst q = gazania.query('A').select($ => $.select(['id']))`
      const result = getScriptBlocks(code, '/src/query.ts')
      expect(result).toHaveLength(1)
      expect(result[0]!.code).toBe(code)
      expect(result[0]!.lineOffset).toBe(0)
    })

    it('extracts a plain <script> block from a .vue file', () => {
      const code = `<template><div/></template>
<script>
import { gazania } from 'gazania'
const q = gazania.query('A').select($ => $.select(['id']))
</script>`
      const result = getScriptBlocks(code, '/src/Comp.vue')
      expect(result).toHaveLength(1)
      expect(result[0]!.code).toContain('import { gazania } from \'gazania\'')
      expect(result[0]!.code).not.toContain('<script>')
    })

    it('extracts a <script setup> block from a .vue file', () => {
      const code = `<template><div/></template>
<script setup lang="ts">
import { gazania } from 'gazania'
const q = gazania.query('B').select($ => $.select(['name']))
</script>`
      const result = getScriptBlocks(code, '/src/Comp.vue')
      expect(result).toHaveLength(1)
      expect(result[0]!.code).toContain('import { gazania } from \'gazania\'')
    })

    it('extracts both <script> and <script setup> as separate blocks', () => {
      const code = `<template><div/></template>
<script>
import { gazania } from 'gazania'
const frag = gazania.fragment('F').on('User').select($ => $.select(['id']))
</script>
<script setup>
import { gazania } from 'gazania'
const q = gazania.query('Q').select($ => $.select(['name']))
</script>`
      const result = getScriptBlocks(code, '/src/Comp.vue')
      expect(result).toHaveLength(2)
      expect(result[0]!.code).toContain('fragment')
      expect(result[1]!.code).toContain('query')
    })

    it('extracts a <script> block from a .svelte file', () => {
      const code = `<script lang="ts">
import { gazania } from 'gazania'
const q = gazania.query('SvelteQ').select($ => $.select(['id']))
</script>
<main><slot /></main>`
      const result = getScriptBlocks(code, '/src/Comp.svelte')
      expect(result).toHaveLength(1)
      expect(result[0]!.code).toContain('import { gazania } from \'gazania\'')
    })

    it('extracts both <script context="module"> and <script> from .svelte', () => {
      const code = `<script context="module">
import { gazania } from 'gazania'
export const frag = gazania.fragment('SF').on('User').select($ => $.select(['id']))
</script>
<script>
import { gazania } from 'gazania'
const q = gazania.query('SQ').select($ => $.select(['name']))
</script>
<main />`
      const result = getScriptBlocks(code, '/src/Comp.svelte')
      expect(result).toHaveLength(2)
    })

    it('returns empty array for .vue file with no script blocks', () => {
      const code = `<template><div>hello</div></template>`
      const result = getScriptBlocks(code, '/src/Comp.vue')
      expect(result).toHaveLength(0)
    })

    it('ignores empty script blocks', () => {
      const code = `<template/><script></script>`
      const result = getScriptBlocks(code, '/src/Comp.vue')
      expect(result).toHaveLength(0)
    })

    it('reports correct lineOffset for SFC script blocks', () => {
      // File layout:
      //   Line 1: <template><div/></template>
      //   Line 2: <script>              ← opening tag; content starts after '>'
      //   Line 3: import x from 'x'     ← first line of block.code (after '\n' is consumed)
      //   Line 4: </script>
      // All leading '\n' chars are consumed into lineOffset, so lineOffset = 2.
      const code = `<template><div/></template>\n<script>\nimport x from 'x'\n</script>`
      const result = getScriptBlocks(code, '/src/Comp.vue')
      expect(result).toHaveLength(1)
      expect(result[0]!.lineOffset).toBe(2)
      expect(result[0]!.code.startsWith('\n')).toBe(false)
    })

    it('handles multiple leading blank lines after the opening script tag', () => {
      // File layout:
      //   Line 1: <template><div/></template>
      //   Line 2: <script>
      //   Line 3: (blank)
      //   Line 4: (blank)
      //   Line 5: import x from 'x'   ← first line of block.code
      // Two '\n' chars are consumed into lineOffset → lineOffset = 4.
      const code = `<template><div/></template>\n<script>\n\n\nimport x from 'x'\n</script>`
      const result = getScriptBlocks(code, '/src/Comp.vue')
      expect(result).toHaveLength(1)
      expect(result[0]!.lineOffset).toBe(4)
      expect(result[0]!.code.startsWith('\n')).toBe(false)
      expect(result[0]!.code.trimStart()).toContain('import x from')
    })
  })
}
