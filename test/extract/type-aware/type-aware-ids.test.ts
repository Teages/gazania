import { describe, expect, it } from 'vitest'
import { collectBuilderNamesForFile } from '../../../src/extract/analyze/type-aware-ids'
import { createTypeCheckerProgram, loadTS, parseTSConfig } from '../../../src/extract/ts-program'

describe('collectBuilderNamesForFile (integration)', () => {
  it('returns empty for missing file', { timeout: 30_000 }, async () => {
    const ts = await loadTS()
    const parsed = parseTSConfig(ts, 'tsconfig.node.json', ts.sys)
    const { program, checker } = createTypeCheckerProgram(ts, parsed, ts.sys)
    const result = collectBuilderNamesForFile(ts, program, checker, '/nonexistent/file.ts')
    expect(result.builderNames).toEqual([])
    expect(result.namespace).toBeUndefined()
  })
})
