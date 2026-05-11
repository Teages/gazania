import type { compileScript as vueCompileScript, parse as vueParse } from 'vue/compiler-sfc'
import type { SFCCompiler, VirtualFileEntry } from './types'

export interface VueCompilerApi { parse: typeof vueParse, compileScript: typeof vueCompileScript }

export async function tryLoadVueCompiler(): Promise<VueCompilerApi | null> {
  try {
    const sfc = await import('vue/compiler-sfc') as VueCompilerApi
    return { parse: sfc.parse, compileScript: sfc.compileScript }
  }
  catch {
    return null
  }
}

export function createVueCompiler(api: VueCompilerApi): SFCCompiler {
  return {
    extensions: ['.vue'],
    compile(source, filename) {
      const { descriptor, errors } = api.parse(source, { filename })
      if (errors.length > 0 || (!descriptor.script && !descriptor.scriptSetup)) {
        return undefined
      }
      const result = api.compileScript(descriptor, { id: filename })
      return { content: result.content, map: result.map as VirtualFileEntry['map'] ?? undefined }
    },
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('tryLoadVueCompiler', () => {
    it('returns a VueCompilerApi when vue is installed', async () => {
      const result = await tryLoadVueCompiler()
      expect(result).not.toBeNull()
      expect(typeof result!.parse).toBe('function')
      expect(typeof result!.compileScript).toBe('function')
    })
  })

  describe('createVueCompiler', async () => {
    const { createTestingSystem } = await import('../../../test/utils/vfs')
    const { loadTS } = await import('../ts-program')

    it('compiles a .vue SFC with script block', async () => {
      const ts = await loadTS()
      const dir = '/vfs/vue-compiler'
      const system = createTestingSystem({
        [`${dir}/Comp.vue`]: '<script>\nexport default {}\n</script>',
      }, ts)
      const api = await tryLoadVueCompiler()
      expect(api).not.toBeNull()
      const compiler = createVueCompiler(api!)
      const source = system.readFile(`${dir}/Comp.vue`)!
      const result = compiler.compile(source, `${dir}/Comp.vue`)
      expect(result).toBeDefined()
      expect(result!.content).toBeTruthy()
    })

    it('returns undefined for template-only .vue files', async () => {
      const api = await tryLoadVueCompiler()
      expect(api).not.toBeNull()
      const compiler = createVueCompiler(api!)
      const result = compiler.compile('<template><div/></template>', 'Comp.vue')
      expect(result).toBeUndefined()
    })
  })
}
