#!/usr/bin/env node
import { argv, exit, stderr, stdout } from 'node:process'
import { parseArgs } from 'node:util'
import { runGenerate } from './generate'

const HELP_MAIN = `\
Usage: gazania <command> [options]

CLI tool to generate TypeScript types from a GraphQL schema

Commands:
  generate    Generate TypeScript type definitions from a GraphQL schema

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

const [, , command, ...rest] = argv

if (!command || command === '-h' || command === '--help') {
  stdout.write(HELP_MAIN)
  exit(0)
}

if (command === '-v' || command === '--version') {
  stdout.write(`${__CLI_VERSION__}\n`)
  exit(0)
}

if (command !== 'generate') {
  stderr.write(`Unknown command: ${command}\n\n${HELP_MAIN}`)
  exit(1)
}

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
