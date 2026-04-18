import type { Program } from 'estree'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import { evaluateGazaniaExpressions } from './evaluate'

export interface GazaniaTransformOptions {
  /**
   * Custom include filter for files to transform.
   * By default, transforms `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` files
   * and Vue `<script>` blocks.
   */
  include?: (id: string) => boolean
}

export const GazaniaTransformPlugin = /* #__PURE__ */ createUnplugin((options?: GazaniaTransformOptions) => {
  return {
    name: 'gazania-transform',
    enforce: 'post',

    transformInclude(id) {
      if (options?.include) {
        return options.include(id)
      }

      const queryIndex = id.indexOf('?')
      const hasQuery = queryIndex >= 0
      const pathname = hasQuery ? id.slice(0, queryIndex) : id
      const search = hasQuery ? id.slice(queryIndex) : ''
      const type = hasQuery ? new URLSearchParams(search).get('type') : null

      // Vue files: only transform script blocks
      if (pathname.endsWith('.vue') && (!search || type === 'script')) {
        return true
      }

      // JS/TS files
      if (/\.((c|m)?j|t)sx?$/.test(pathname)) {
        return true
      }

      return false
    },

    transform(code, id) {
      if (!code.includes('gazania')) {
        return
      }

      const ast = this.parse(code) as unknown as Program

      const results = evaluateGazaniaExpressions(code, ast)

      if (results.length === 0) {
        return
      }

      const s = new MagicString(code)

      for (const { start, end, replacement } of results) {
        s.overwrite(start, end, replacement)
      }

      return {
        code: s.toString(),
        map: s.generateMap({ includeContent: true, source: id }),
      }
    },
  }
})

// Framework-specific plugin exports
export const vite = GazaniaTransformPlugin.vite
export const rollup = GazaniaTransformPlugin.rollup
export const webpack = GazaniaTransformPlugin.webpack
export const esbuild = GazaniaTransformPlugin.esbuild
export const rolldown = GazaniaTransformPlugin.rolldown
export const rspack = GazaniaTransformPlugin.rspack
export const farm = GazaniaTransformPlugin.farm

export default GazaniaTransformPlugin
