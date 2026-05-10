import type { GraphQLSchema } from 'graphql'

export type SchemaSource = string | GraphQLSchema

export interface GenerateOptions {
  scalars?: Record<string, string | { input: string, output: string }>
}
