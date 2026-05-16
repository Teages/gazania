import type { GraphQLSchema } from 'graphql'

export interface GenerateConfig {
  source: string | GraphQLSchema
  scalars?: Record<string, string | { input: string, output: string }>
  url?: string
}
