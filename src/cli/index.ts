#!/usr/bin/env node
import type { SkippedExtractionCategory } from '../extract/manifest'
import { argv, exit, cwd as getCwd, stderr, stdout } from 'node:process'
import { parseArgs } from 'node:util'
import { runExtract } from './extract'
import { runGenerate } from './generate'

const HELP_MAIN = `\
Usage: gazania <command> [options]

CLI tool to generate TypeScript types from a GraphQL schema

Commands:
  generate    Generate TypeScript type definitions from a GraphQL schema
  extract     Extract GraphQL operations and produce a persisted query manifest

Options:
  -h, --help     Show help
  -v, --version  Show version
`

const HELP_GENERATE = `\
Usage: gazania generate [options]

Generate TypeScript type definitions from a GraphQL schema

Options:
  -s, --schema <source>  Schema source: URL or file path (overrides config)
  -o, --output <path>    Output file path (overrides config)
  -c, --config <path>    Path to config file
  --silent               Suppress output
  -h, --help             Show help
`

const HELP_EXTRACT = `\
Usage: gazania extract [options]

Extract GraphQL operations and produce a persisted query manifest

Options:
  -d, --dir <path>       Directory to scan (default: src)
  -o, --output <path>    Output manifest file path (default: stdout). Use '-' for explicit stdout.
  --include <glob>       File glob pattern to include (default: **/*.{ts,tsx,js,jsx,vue,svelte})
  --algorithm <alg>      Hash algorithm (default: sha256)
  --tsconfig <path>      (required) Path to tsconfig.json for cross-file partial/section resolution
  --silent               Suppress output
  --ignore-unresolved    Ignore unresolved reference errors
  --ignore-analysis      Ignore static analysis failures
  --ignore-circular      Ignore circular fragment reference errors
  --ignore-all           Ignore all extraction errors
  --no-emit              Suppress manifest output (useful for validation)
  -s, --schema <path>    Schema file path, URL, or SDL string for query validation
  --strict               Treat validation warnings (deprecated fields) as errors
  -h, --help             Show help
`

const [, , command, ...rest] = argv

if (!command || command === '-h' || command === '--help') {
  stdout.write(HELP_MAIN)
  exit(0)
}

if (command === '-v' || command === '--version') {
  stdout.write(`${__CLI_VERSION__}\n`)
  exit(0)
}

if (command === 'generate') {
  const { values } = parseArgs({
    args: rest,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      config: { type: 'string', short: 'c' },
      silent: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  })

  if (values.help) {
    stdout.write(HELP_GENERATE)
    exit(0)
  }

  try {
    await runGenerate({
      schema: values.schema,
      output: values.output,
      config: values.config,
      silent: values.silent ?? false,
    })
  }
  catch (err) {
    stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
    exit(1)
  }
}
else if (command === 'extract') {
  const { values } = parseArgs({
    args: rest,
    options: {
      'dir': { type: 'string', short: 'd' },
      'output': { type: 'string', short: 'o' },
      'include': { type: 'string' },
      'algorithm': { type: 'string' },
      'tsconfig': { type: 'string' },
      'silent': { type: 'boolean' },
      'ignore-unresolved': { type: 'boolean' },
      'ignore-analysis': { type: 'boolean' },
      'ignore-circular': { type: 'boolean' },
      'ignore-all': { type: 'boolean' },
      'no-emit': { type: 'boolean' },
      'schema': { type: 'string', short: 's' },
      'strict': { type: 'boolean' },
      'help': { type: 'boolean', short: 'h' },
    },
    strict: true,
  })

  if (values.help) {
    stdout.write(HELP_EXTRACT)
    exit(0)
  }

  try {
    const ignoreCategories: SkippedExtractionCategory[] = []
    if (values['ignore-unresolved'] || values['ignore-all']) {
      ignoreCategories.push('unresolved')
    }
    if (values['ignore-analysis'] || values['ignore-all']) {
      ignoreCategories.push('analysis')
    }
    if (values['ignore-circular'] || values['ignore-all']) {
      ignoreCategories.push('circular')
    }

    await runExtract({
      dir: values.dir ?? 'src',
      output: values.output ?? null,
      noEmit: values['no-emit'] ?? false,
      include: values.include ?? '**/*.{ts,tsx,js,jsx,vue,svelte}',
      algorithm: values.algorithm ?? 'sha256',
      silent: values.silent ?? false,
      cwd: getCwd(),
      tsconfig: values.tsconfig,
      ignoreCategories,
      schema: values.schema,
      strict: values.strict ?? false,
    })
  }
  catch (err) {
    stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
    exit(1)
  }
}
else {
  stderr.write(`Unknown command: ${command}\n\n${HELP_MAIN}`)
  exit(1)
}
