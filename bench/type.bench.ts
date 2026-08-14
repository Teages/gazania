/**
 * Type-checking performance benchmarks.
 *
 * Each bench case creates a fresh TypeScript program from an in-memory source
 * snippet and measures `getSemanticDiagnostics()` – the full type-inference
 * pass – for progressively more complex gazania selections.
 *
 * These benchmarks are intentionally slower than the runtime ones (a full
 * TypeScript compiler invocation per iteration). Use them to establish
 * baselines before and after changes to the type definitions.
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { bench, describe, expect } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// The virtual file is placed inside bench/ so that relative imports resolve
// against the real project layout:  '../src/...' → 'src/...'
const VIRTUAL_FILE = resolve(projectRoot, 'bench/_virtual_type_bench_.ts')

// Compiler options that match the project's tsconfig.base.json.
// `types` includes `vitest/importMeta` so the `import.meta.vitest` guards in
// the library source files do not generate cascading errors.
const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  types: ['vitest/importMeta'],
  typeRoots: [resolve(projectRoot, 'node_modules')],
}

// Imports that every scenario needs.
const IMPORTS = `
import type { TypedGazania } from '../src/index'
import type { Schema } from '../test/types/schema'
declare const g: TypedGazania<Schema>
`

interface TypeCheckResult {
  diagnostics: ts.Diagnostic[]
  durationMs: number
}

/**
 * Create a fresh TypeScript program from an in-memory `code` string and run
 * `getSemanticDiagnostics()`.  A new compiler host is constructed on every
 * call so that caches do not carry over between bench iterations.
 */
function typeCheck(code: string): TypeCheckResult {
  const defaultHost = ts.createCompilerHost(COMPILER_OPTIONS)

  const customHost: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile(fileName, languageVersion, ...rest) {
      if (fileName === VIRTUAL_FILE) {
        return ts.createSourceFile(fileName, code, languageVersion)
      }
      return defaultHost.getSourceFile(fileName, languageVersion, ...rest)
    },
    fileExists(fileName) {
      if (fileName === VIRTUAL_FILE) {
        return true
      }
      return defaultHost.fileExists(fileName)
    },
    readFile(fileName) {
      if (fileName === VIRTUAL_FILE) {
        return code
      }
      return defaultHost.readFile(fileName)
    },
  }

  const program = ts.createProgram({
    rootNames: [VIRTUAL_FILE],
    options: COMPILER_OPTIONS,
    host: customHost,
  })

  const start = performance.now()
  const diagnostics = program.getSemanticDiagnostics()
  const durationMs = performance.now() - start

  return { diagnostics: [...diagnostics], durationMs }
}

// ─── Benchmark scenarios ──────────────────────────────────────────────────────

const SCENARIOS = {
  'simple – single scalar field': `
    ${IMPORTS}
    const _doc = g.query('Hello').select($ => $.select(['hello']))
  `,

  'flat – multiple scalar fields': `
    ${IMPORTS}
    const _doc = g.query('GetUsers').select($ => $.select([{
      users: $ => $.select(['id', 'name', 'email']),
    }]))
  `,

  'nested – one level deep': `
    ${IMPORTS}
    const _doc = g.query('GetUser')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          'id',
          'name',
          { sayings: $ => $.select(['id', 'content']) },
        ]),
      }]))
  `,

  'nested – two levels deep': `
    ${IMPORTS}
    const _doc = g.query('GetUserDeep')
      .vars({ id: 'Int!' })
      .select(($, vars) => $.select([{
        user: $ => $.args({ id: vars.id }).select([
          'id',
          'name',
          {
            sayings: $ => $.select([
              'id',
              'content',
              'category',
              { owner: $ => $.select(['id', 'name', 'email']) },
            ]),
          },
        ]),
      }]))
  `,

  'union – inline fragments': `
    ${IMPORTS}
    const _doc = g.query('GetAll').select($ => $.select([{
      all: $ => $.select([
        '__typename',
        {
          '... on Saying': $ => $.select(['id', 'content', 'category']),
          '... on User': $ => $.select(['id', 'name', 'email']),
        },
      ]),
    }]))
  `,

  'partial – define and spread': `
    ${IMPORTS}
    const sayingFields = g.partial('SayingFields').on('Saying').select($ =>
      $.select(['id', 'content', 'category', 'createdAt'])
    )
    const _doc = g.query('GetSayings').select($ => $.select([{
      sayings: $ => $.select([...sayingFields({})]),
    }]))
  `,

  'fragment – standalone typed fragment': `
    ${IMPORTS}
    const _frag = g.fragment('UserFields').on('User').select($ =>
      $.select(['id', 'name', 'email'])
    )
  `,

  'complex – mixed fields, args, inline fragments, partial': `
    ${IMPORTS}
    const userFields = g.partial('UserFields').on('User').select($ =>
      $.select(['id', 'name', 'email'])
    )
    const _doc = g.query('Complex')
      .vars({ userId: 'Int!', category: 'CategoryEnum' })
      .select(($, vars) => $.select([
        {
          user: $ => $.args({ id: vars.userId }).select([
            ...userFields(vars),
            '__typename',
            {
              sayings: $ => $.args({ category: vars.category }).select([
                'id',
                'content',
                'category',
                {
                  owner: $ => $.select(['id', 'name']),
                },
              ]),
              friends: $ => $.select(['id', 'name']),
            },
          ]),
          all: $ => $.select([
            '__typename',
            {
              '... on Saying': $ => $.select(['id', 'content']),
              '... on User': $ => $.select(['id', 'name']),
            },
          ]),
        },
      ]))
  `,
} as const

// ─── Vitest bench suite ───────────────────────────────────────────────────────

describe('type check', () => {
  for (const [name, code] of Object.entries(SCENARIOS)) {
    bench(
      name,
      () => {
        const result = typeCheck(code)
        // Ensure the code type-checks without errors (catches benchmark
        // fixture bugs rather than silently measuring broken scenarios).
        expect(result.diagnostics.length, `unexpected type errors in "${name}"`).toBe(0)
      },
      // TypeScript compiler runs are expensive: keep iteration count small
      // while still providing meaningful comparative data.
      { iterations: 3, warmupIterations: 1 },
    )
  }
})
