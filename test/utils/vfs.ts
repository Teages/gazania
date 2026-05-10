/**
 * Test utilities for the extract module.
 *
 * This file is only imported inside `if (import.meta.vitest)` blocks,
 * so it is dead-code eliminated from production bundles.
 */

/**
 * Create a virtual filesystem backed by an in-memory file map.
 *
 * The returned object satisfies `ExtractFS` and also provides
 * `directoryExists` / `getDirectories` so it can be used as a
 * drop-in for `ts.System` via `createTestingSystem`.
 */
export function createVFS(files: Record<string, string>) {
  const fileMap = new Map(Object.entries(files))

  const dirSet = new Set<string>()
  for (const filePath of fileMap.keys()) {
    const parts = filePath.split('/')
    for (let i = 1; i < parts.length; i++) {
      dirSet.add(parts.slice(0, i).join('/'))
    }
  }

  return {
    readFile: (path: string) => fileMap.get(path),
    fileExists: (path: string) => fileMap.has(path),
    readDirectory: (
      path: string,
      extensions?: readonly string[],
      _excludes?: readonly string[] | undefined,
      _includes?: readonly string[] | undefined,
      _depth?: number,
    ): string[] => {
      const prefix = path.endsWith('/') ? path : `${path}/`
      return [...fileMap.keys()].filter((f) => {
        if (!f.startsWith(prefix)) return false
        if (extensions && extensions.length > 0) {
          return extensions.some(ext => f.endsWith(ext))
        }
        return true
      })
    },
    directoryExists: (dir: string) => dirSet.has(dir),
    getDirectories: (dir: string) => {
      const prefix = dir.endsWith('/') ? dir : `${dir}/`
      const result = new Set<string>()
      for (const d of dirSet) {
        if (!d.startsWith(prefix)) continue
        const rest = d.substring(prefix.length)
        const firstPart = rest.split('/')[0]
        if (firstPart) result.add(firstPart)
      }
      return [...result]
    },
  }
}

/**
 * Create a `ts.System` layered on top of `ts.sys`:
 * virtual files take priority; anything not in the map falls through
 * to the real filesystem.
 *
 * This lets tests inject fixture files while still resolving
 * real modules (e.g. `gazania` → `src/index.ts` via `paths`).
 */
export function createTestingSystem(
  virtualFiles: Record<string, string>,
  ts: typeof import('typescript'),
): import('typescript').System {
  const vfs = createVFS(virtualFiles)

  return {
    ...ts.sys,
    readFile: (path: string) => vfs.readFile(path) ?? ts.sys.readFile(path),
    fileExists: (path: string) => vfs.fileExists(path) || ts.sys.fileExists(path),
    readDirectory: (
      path: string,
      extensions?: readonly string[],
      excludes?: readonly string[] | undefined,
      includes?: readonly string[] | undefined,
      depth?: number,
    ): string[] => {
      const virtual = vfs.readDirectory(path, extensions, excludes, includes, depth)
      const real = ts.sys.readDirectory(path, extensions, excludes, includes, depth) ?? []
      return [...new Set([...virtual, ...real])]
    },
    directoryExists: (dir: string) =>
      vfs.directoryExists(dir) || (ts.sys.directoryExists?.(dir) ?? false),
    getDirectories: (dir: string) => {
      const virtual = vfs.getDirectories(dir)
      const real = ts.sys.getDirectories?.(dir) ?? []
      return [...new Set([...virtual, ...real])]
    },
  }
}
