/**
 * Extracts the JavaScript/TypeScript script content from framework-specific
 * single-file component (SFC) formats before passing to the evaluator.
 *
 * - `.vue`: extracts `<script>` and `<script setup>` blocks
 * - `.svelte`: extracts `<script>` and `<script context="module">` blocks
 * - others: returns `[code]` unchanged
 *
 * Each block is returned as a separate string so duplicate imports across
 * blocks (common in Vue SFCs) do not cause parse errors.
 */
export function getScriptBlocks(code: string, filePath: string): string[] {
  if (filePath.endsWith('.vue') || filePath.endsWith('.svelte')) {
    return extractSFCScriptBlocks(code)
  }
  return [code]
}

/**
 * Regex-based `<script>` block extractor.
 *
 * A new RegExp instance is created on every call to avoid shared `lastIndex`
 * state across calls. The regex is intentionally simple — it stops at the
 * first `</script>` after the opening tag, which is the standard approach
 * used by Vite's Vue plugin and other ecosystem tools.
 */
function extractSFCScriptBlocks(code: string): string[] {
  const re = /<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi
  const blocks: string[] = []
  let match: RegExpExecArray | null

  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(code)) !== null) {
    const full = match[0]!
    const openTagEnd = full.indexOf('>') + 1
    const closeTagStart = full.lastIndexOf('</script>')
    if (openTagEnd > 0 && closeTagStart > openTagEnd) {
      const content = full.slice(openTagEnd, closeTagStart)
      if (content.trim()) {
        blocks.push(content)
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
      expect(result[0]).toBe(code)
    })

    it('extracts a plain <script> block from a .vue file', () => {
      const code = `<template><div/></template>
<script>
import { gazania } from 'gazania'
const q = gazania.query('A').select($ => $.select(['id']))
</script>`
      const result = getScriptBlocks(code, '/src/Comp.vue')
      expect(result).toHaveLength(1)
      expect(result[0]).toContain('import { gazania } from \'gazania\'')
      expect(result[0]).not.toContain('<script>')
    })

    it('extracts a <script setup> block from a .vue file', () => {
      const code = `<template><div/></template>
<script setup lang="ts">
import { gazania } from 'gazania'
const q = gazania.query('B').select($ => $.select(['name']))
</script>`
      const result = getScriptBlocks(code, '/src/Comp.vue')
      expect(result).toHaveLength(1)
      expect(result[0]).toContain('import { gazania } from \'gazania\'')
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
      expect(result[0]).toContain('fragment')
      expect(result[1]).toContain('query')
    })

    it('extracts a <script> block from a .svelte file', () => {
      const code = `<script lang="ts">
import { gazania } from 'gazania'
const q = gazania.query('SvelteQ').select($ => $.select(['id']))
</script>
<main><slot /></main>`
      const result = getScriptBlocks(code, '/src/Comp.svelte')
      expect(result).toHaveLength(1)
      expect(result[0]).toContain('import { gazania } from \'gazania\'')
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
  })
}
