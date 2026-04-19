#!/usr/bin/env node
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
  -o, --output <path>    Output manifest file path (default: gazania-manifest.json)
  --include <glob>       File glob pattern to include (default: **/*.{ts,tsx,js,jsx,vue,svelte})
  --algorithm <alg>      Hash algorithm (default: sha256)
  --silent               Suppress output
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
      dir: { type: 'string', short: 'd' },
      output: { type: 'string', short: 'o' },
      include: { type: 'string' },
      algorithm: { type: 'string' },
      silent: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  })

  if (values.help) {
    stdout.write(HELP_EXTRACT)
    exit(0)
  }

  try {
    await runExtract({
      dir: values.dir ?? 'src',
      output: values.output ?? 'gazania-manifest.json',
      include: values.include ?? '**/*.{ts,tsx,js,jsx,vue,svelte}',
      algorithm: values.algorithm ?? 'sha256',
      silent: values.silent ?? false,
      cwd: getCwd(),
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
