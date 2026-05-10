import { describe, expect, it } from 'vitest'
import { createTypeCheckerProgram, loadTS, parseTSConfig } from '../../src/extract/ts-program'

describe('createTypeCheckerProgram (integration)', () => {
  it('returns program with TypeChecker using project tsconfig', async () => {
    const ts = await loadTS()
    const parsed = parseTSConfig(ts, 'tsconfig.json', ts.sys)
    const { program, checker } = createTypeCheckerProgram(ts, parsed, ts.sys)

    expect(program).toBeDefined()
    expect(checker).toBeDefined()
    expect(typeof checker.getTypeAtLocation).toBe('function')
  })

  it('has source files from the project', { timeout: 30_000 }, async () => {
    const ts = await loadTS()
    const parsed = parseTSConfig(ts, 'tsconfig.node.json', ts.sys)
    const { program } = createTypeCheckerProgram(ts, parsed, ts.sys)

    expect(program.getSourceFiles().length).toBeGreaterThan(0)
  })
})
