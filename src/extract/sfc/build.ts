import type { SFCCompiler, VirtualFileEntry } from './types'

export function buildSFCVirtualFiles(
  files: string[],
  system: import('typescript').System,
  compilers: readonly SFCCompiler[],
): Map<string, VirtualFileEntry> {
  const extMap = new Map<string, SFCCompiler>()
  for (const c of compilers) {
    for (const ext of c.extensions) {
      extMap.set(ext, c)
    }
  }
  const virtualFiles = new Map<string, VirtualFileEntry>()
  for (const file of files) {
    const dotIndex = file.lastIndexOf('.')
    if (dotIndex === -1) {
      continue
    }
    const ext = file.slice(dotIndex)
    const compiler = extMap.get(ext)
    if (!compiler) {
      continue
    }
    const source = system.readFile(file)
    if (!source) {
      continue
    }
    try {
      const result = compiler.compile(source, file)
      if (result) {
        virtualFiles.set(`${file}.ts`, result)
      }
    }
    catch {
      // Skip files that cannot be compiled
    }
  }
  return virtualFiles
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('buildSFCVirtualFiles', async () => {
    const { createTestingSystem } = await import('../../../test/utils/vfs')
    const { loadTS } = await import('../ts-program')

    function makeMockCompiler(
      ext: string,
      compiled: string,
      opts?: { throwOnCompile?: boolean, returnUndefined?: boolean },
    ): SFCCompiler {
      return {
        extensions: [ext],
        compile: () => {
          if (opts?.throwOnCompile) {
            throw new Error('compile error')
          }
          if (opts?.returnUndefined) {
            return undefined
          }
          return { content: compiled }
        },
      }
    }

    it('compiles files matching compiler extensions', async () => {
      const ts = await loadTS()
      const dir = '/vfs/sfc-virtual'
      const system = createTestingSystem({
        [`${dir}/Comp.vue`]: '<script>export default {}</script>',
      }, ts)
      const compiler = makeMockCompiler('.vue', 'export default {}')
      const result = buildSFCVirtualFiles([`${dir}/Comp.vue`], system, [compiler])
      expect(result.has(`${dir}/Comp.vue.ts`)).toBe(true)
      expect(result.get(`${dir}/Comp.vue.ts`)?.content).toBe('export default {}')
    })

    it('skips files with no matching compiler', async () => {
      const ts = await loadTS()
      const dir = '/vfs/sfc-virtual'
      const system = createTestingSystem({
        [`${dir}/Comp.svelte`]: '<script>export let x = 1</script>',
      }, ts)
      const compiler = makeMockCompiler('.vue', 'compiled')
      const result = buildSFCVirtualFiles([`${dir}/Comp.svelte`], system, [compiler])
      expect(result.size).toBe(0)
    })

    it('skips files not present on the system', async () => {
      const ts = await loadTS()
      const system = createTestingSystem({}, ts)
      const compiler = makeMockCompiler('.vue', 'compiled')
      const result = buildSFCVirtualFiles(['/nonexistent/Missing.vue'], system, [compiler])
      expect(result.size).toBe(0)
    })

    it('skips files where compile throws', async () => {
      const ts = await loadTS()
      const dir = '/vfs/sfc-virtual'
      const system = createTestingSystem({
        [`${dir}/Broken.vue`]: '<script>broken</script>',
      }, ts)
      const compiler = makeMockCompiler('.vue', '', { throwOnCompile: true })
      const result = buildSFCVirtualFiles([`${dir}/Broken.vue`], system, [compiler])
      expect(result.size).toBe(0)
    })

    it('skips files where compile returns undefined', async () => {
      const ts = await loadTS()
      const dir = '/vfs/sfc-virtual'
      const system = createTestingSystem({
        [`${dir}/NoScript.vue`]: '<template><div/></template>',
      }, ts)
      const compiler = makeMockCompiler('.vue', '', { returnUndefined: true })
      const result = buildSFCVirtualFiles([`${dir}/NoScript.vue`], system, [compiler])
      expect(result.size).toBe(0)
    })

    it('handles multiple files with multiple compilers', async () => {
      const ts = await loadTS()
      const dir = '/vfs/sfc-virtual'
      const system = createTestingSystem({
        [`${dir}/A.vue`]: '<script>export const a = 1</script>',
        [`${dir}/B.svelte`]: '<script>export let b = 2</script>',
      }, ts)
      const vueCompiler = makeMockCompiler('.vue', 'compiled-vue')
      const svelteCompiler = makeMockCompiler('.svelte', 'compiled-svelte')
      const result = buildSFCVirtualFiles(
        [`${dir}/A.vue`, `${dir}/B.svelte`],
        system,
        [vueCompiler, svelteCompiler],
      )
      expect(result.has(`${dir}/A.vue.ts`)).toBe(true)
      expect(result.has(`${dir}/B.svelte.ts`)).toBe(true)
    })
  })
}
