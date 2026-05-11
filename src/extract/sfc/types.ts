export interface VirtualFileEntry {
  content: string
  map?: { version: number, sources: string[], mappings: string, names?: string[], sourcesContent?: (string | null)[] }
}

export interface SFCCompiler {
  extensions: readonly string[]
  compile: (source: string, filename: string) => VirtualFileEntry | undefined
}
