import type { SFCCompiler } from './types'

export interface Svelte2TsxApi {
  svelte2tsx: (source: string, options: {
    filename?: string
    mode?: 'ts' | 'dts'
    isTsFile?: boolean
  }) => { code: string, map?: { version: number, sources: string[], mappings: string, names?: string[], sourcesContent?: (string | null)[] } }
}

async function tryLoadSvelte2Tsx(): Promise<Svelte2TsxApi | null> {
  try {
    const mod = await import('svelte2tsx') as Svelte2TsxApi
    return { svelte2tsx: mod.svelte2tsx }
  }
  catch {
    return null
  }
}

export async function createSvelteCompiler(): Promise<SFCCompiler | null> {
  const api = await tryLoadSvelte2Tsx()
  if (!api) {
    return null
  }
  return {
    extensions: ['.svelte'],
    compile(source, filename) {
      const isTsFile = /<script[^>]+\blang\s*=\s*["'](?:ts|typescript)["']/.test(source)
      const result = api.svelte2tsx(source, { filename, mode: 'ts', isTsFile })
      return { content: result.code, map: result.map ?? undefined }
    },
  }
}
