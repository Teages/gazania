import type { CreateHostFn } from '../../../src/extract'
/**
 * Integration tests for TypeChecker-based builder name detection.
 *
 * These tests exercise the `extract()` API end-to-end with patterns that
 * require the TypeScript TypeChecker to resolve builder names:
 *
 *   1. Re-export / barrel file
 *   2. Aliased factory (createGazania)
 *   3. Namespace import (import * as)
 *   4. Mixed patterns
 *   5. Error path (missing tsconfig)
 */
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extract } from '../../../src/extract'
import { loadTS, parseTSConfig } from '../../../src/extract/ts-program'
import { createTestingSystem } from '../../../test/utils/vfs'

const sha256 = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`

const ts = await loadTS()
const projectRoot = resolve(process.cwd())

function makeTSConfig() {
  return JSON.stringify({
    compilerOptions: {
      target: 'esnext',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      baseUrl: projectRoot,
      paths: {
        gazania: ['src/index.ts'],
      },
    },
    include: ['src'],
  })
}

function buildFS(files: Record<string, string>, baseDir: string) {
  const testSystem = createTestingSystem(files, ts)
  const parsed = parseTSConfig(ts, `${baseDir}/tsconfig.json`, testSystem)

  const createHost: CreateHostFn = (_ts, sys, opts) => {
    const host = _ts.createCompilerHost(opts)
    host.readFile = fileName => sys.readFile(fileName)
    host.fileExists = fileName => sys.fileExists(fileName)
    if (sys.readDirectory) {
      host.readDirectory = (rootDir, extensions, excludes, includes, depth) =>
        sys.readDirectory!(rootDir, extensions, excludes, includes, depth)
    }
    host.directoryExists = dir => testSystem.directoryExists(dir)
    host.getDirectories = dir => testSystem.getDirectories(dir)
    host.getCurrentDirectory = () => sys.getCurrentDirectory()
    return host
  }

  return { parsed, fs: testSystem, createHost }
}

describe('type-aware extract: re-export / barrel file', () => {
  const baseDir = '/vfs/ta-reexport'

  it('extracts a query when gazania is re-exported through a barrel file', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/barrel.ts`]: `export { gazania } from 'gazania'`,
      [`${baseDir}/src/consumer.ts`]: `import { gazania } from './barrel'\nconst doc = gazania.query('BarrelQuery').select($ => $.select(['id', 'name']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('BarrelQuery')
    expect(manifest.operations.BarrelQuery.body).toContain('query BarrelQuery')
    expect(manifest.operations.BarrelQuery.body).toContain('id')
    expect(manifest.operations.BarrelQuery.body).toContain('name')
  })

  it('extracts a query from a two-level re-export chain', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/api.ts`]: `export { gazania } from 'gazania'`,
      [`${baseDir}/src/index.ts`]: `export { gazania } from './api'`,
      [`${baseDir}/src/consumer.ts`]: `import { gazania } from './index'\nconst doc = gazania.query('DeepBarrelQuery').select($ => $.select(['status']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('DeepBarrelQuery')
    expect(manifest.operations.DeepBarrelQuery.body).toContain('query DeepBarrelQuery')
    expect(manifest.operations.DeepBarrelQuery.body).toContain('status')
  })

  it('extracts a query when barrel also exports createGazania', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/barrel.ts`]: `export { gazania, createGazania } from 'gazania'`,
      [`${baseDir}/src/consumer.ts`]: `import { gazania } from './barrel'\nconst doc = gazania.query('BarrelExportQuery').select($ => $.select(['id']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('BarrelExportQuery')
  })
})

describe('type-aware extract: aliased factory', () => {
  const baseDir = '/vfs/ta-factory'

  it('extracts a query when builder is created via createGazania() in the same file', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import { createGazania } from 'gazania'\nconst g = createGazania('https://api.example.com/graphql')\nconst doc = g.query('FactoryQuery').select($ => $.select(['id', 'name']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('FactoryQuery')
    expect(manifest.operations.FactoryQuery.body).toContain('query FactoryQuery')
    expect(manifest.operations.FactoryQuery.body).toContain('id')
    expect(manifest.operations.FactoryQuery.body).toContain('name')
  })

  it('extracts a mutation created via createGazania() in the same file', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/mutation.ts`]: `import { createGazania } from 'gazania'\nconst g = createGazania('https://api.example.com/graphql')\nconst doc = g.mutation('FactoryMutation')\n  .vars({ input: 'String!' })\n  .select(($, vars) => $.select([{ createUser: $ => $.args({ input: vars.input }).select(['id']) }]))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('FactoryMutation')
    expect(manifest.operations.FactoryMutation.body).toContain('mutation FactoryMutation')
  })

  it('extracts a fragment created via createGazania() in the same file', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/frag.ts`]: `import { createGazania } from 'gazania'\nconst g = createGazania('https://api.example.com/graphql')\nconst doc = g.fragment('FactoryFragment').on('User').select($ => $.select(['id', 'email']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.fragments).toHaveProperty('FactoryFragment')
    expect(manifest.fragments.FactoryFragment.body).toContain('fragment FactoryFragment on User')
  })

  it('extracts a query when factory builder is imported from a local module that exports gazania', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/api.ts`]: `import { createGazania } from 'gazania'\nexport const gazania = createGazania('https://api.example.com/graphql')`,
      [`${baseDir}/src/query.ts`]: `import { gazania } from './api'\nconst doc = gazania.query('CrossFileFactoryQuery').select($ => $.select(['id']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('CrossFileFactoryQuery')
    expect(manifest.operations.CrossFileFactoryQuery.body).toContain('query CrossFileFactoryQuery')
  })

  it('extracts a query that uses cross-file partials with factory builder', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/api.ts`]: `import { createGazania } from 'gazania'\nexport const gazania = createGazania('https://api.example.com/graphql')`,
      [`${baseDir}/src/partials.ts`]: `import { gazania } from './api'\nexport const userFields = gazania.partial('FactoryUserFields')\n  .on('User')\n  .select($ => $.select(['id', 'name']))`,
      [`${baseDir}/src/query.ts`]: `import { gazania } from './api'\nimport { userFields } from './partials'\nconst doc = gazania.query('FactoryWithPartial')\n  .select($ => $.select([{\n    user: $ => $.select([...userFields({})]),\n  }]))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('FactoryWithPartial')
    expect(manifest.operations.FactoryWithPartial.body).toContain('...FactoryUserFields')
    expect(manifest.operations.FactoryWithPartial.body).toContain('fragment FactoryUserFields on User')
  })
})

describe('type-aware extract: namespace import', () => {
  const baseDir = '/vfs/ta-namespace'

  it('extracts a query via namespace import (import * as)', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/query.ts`]: `import * as G from 'gazania'\nconst doc = G.gazania.query('NsQuery').select($ => $.select(['id']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('NsQuery')
    expect(manifest.operations.NsQuery.body).toContain('query NsQuery')
    expect(manifest.operations.NsQuery.body).toContain('id')
  })

  it('extracts a mutation via namespace import', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/mutation.ts`]: `import * as G from 'gazania'\nconst doc = G.gazania.mutation('NsMutation')\n  .vars({ id: 'ID!' })\n  .select(($, vars) => $.select([{ deleteUser: $ => $.args({ id: vars.id }).select(['success']) }]))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('NsMutation')
    expect(manifest.operations.NsMutation.body).toContain('mutation NsMutation')
  })

  it('extracts a fragment via namespace import', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/frag.ts`]: `import * as G from 'gazania'\nconst doc = G.gazania.fragment('NsFragment').on('User').select($ => $.select(['name']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.fragments).toHaveProperty('NsFragment')
    expect(manifest.fragments.NsFragment.body).toContain('fragment NsFragment on User')
  })

  it('extracts a query that uses cross-file partial via namespace import', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/partials.ts`]: `import * as G from 'gazania'\nexport const userFields = G.gazania.partial('NsUserFields')\n  .on('User')\n  .select($ => $.select(['id', 'email']))`,
      [`${baseDir}/src/query.ts`]: `import * as G from 'gazania'\nimport { userFields } from './partials'\nconst doc = G.gazania.query('NsPartialQuery')\n  .select($ => $.select([{\n    user: $ => $.select([...userFields({})]),\n  }]))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('NsPartialQuery')
    expect(manifest.operations.NsPartialQuery.body).toContain('...NsUserFields')
    expect(manifest.operations.NsPartialQuery.body).toContain('fragment NsUserFields on User')
  })
})

describe('type-aware extract: mixed patterns in a single project', () => {
  const baseDir = '/vfs/ta-mixed'

  it('extracts operations from direct import, factory, and namespace in one project', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/direct.ts`]: `import { gazania } from 'gazania'\nconst DirectQuery = gazania.query('DirectQuery').select($ => $.select(['id']))`,
      [`${baseDir}/src/factory.ts`]: `import { createGazania } from 'gazania'\nconst g = createGazania('https://api.example.com/graphql')\nconst FactoryQuery = g.query('FactoryQuery').select($ => $.select(['name']))`,
      [`${baseDir}/src/namespace.ts`]: `import * as NS from 'gazania'\nconst NsQuery = NS.gazania.query('NsQuery').select($ => $.select(['email']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('DirectQuery')
    expect(manifest.operations).toHaveProperty('FactoryQuery')
    expect(manifest.operations).toHaveProperty('NsQuery')
  })

  it('extracts operations from factory module re-exported through a barrel', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/api.ts`]: `import { createGazania } from 'gazania'\nexport const gazania = createGazania('https://api.example.com/graphql')`,
      [`${baseDir}/src/index.ts`]: `export { gazania } from './api'`,
      [`${baseDir}/src/query.ts`]: `import { gazania } from './index'\nconst doc = gazania.query('BarrelFactoryQuery').select($ => $.select(['id', 'status']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('BarrelFactoryQuery')
    expect(manifest.operations.BarrelFactoryQuery.body).toContain('query BarrelFactoryQuery')
    expect(manifest.operations.BarrelFactoryQuery.body).toContain('status')
  })

  it('extracts operations from namespace and factory module in one project', async () => {
    const files = {
      [`${baseDir}/tsconfig.json`]: makeTSConfig(),
      [`${baseDir}/src/api.ts`]: `import { createGazania } from 'gazania'\nexport const gazania = createGazania('https://api.example.com/graphql')`,
      [`${baseDir}/src/consumer-factory.ts`]: `import { gazania } from './api'\nconst doc = gazania.query('MixedFactory').select($ => $.select(['id']))`,
      [`${baseDir}/src/consumer-ns.ts`]: `import * as G from 'gazania'\nconst doc = G.gazania.query('MixedNs').select($ => $.select(['name']))`,
    }
    const { parsed, fs, createHost } = buildFS(files, baseDir)
    const { manifest } = await extract({ dir: `${baseDir}/src`, hash: sha256, tsconfig: parsed, fs, createHost })
    expect(manifest.operations).toHaveProperty('MixedFactory')
    expect(manifest.operations).toHaveProperty('MixedNs')
  })
})

describe('type-aware extract: error handling', () => {
  it('throws an error when tsconfig is not provided', async () => {
    await expect(
      // @ts-expect-error — intentionally omitting tsconfig
      extract({ dir: 'src', hash: sha256 }),
    ).rejects.toThrow(/tsconfig is required/)
  })

  it('throws an error when tsconfig is undefined', async () => {
    await expect(
      extract({ dir: 'src', hash: sha256, tsconfig: undefined as any }),
    ).rejects.toThrow(/tsconfig is required/)
  })
})
