import type { FieldDollar, SelectionInput } from '../dollar'
import type { EnumFunction } from '../enum'
import type { Variable } from '../variable'
import { createFieldDollar } from '../dollar'

export type SelectCallback<V = Record<string, Variable>> = ($: RootDollar, vars: V) => FieldDollar

export interface RootDollar {
  readonly enum: EnumFunction
  select: <const T extends SelectionInput>(selection: [...T]) => FieldDollar
}

export function createRootDollar(enumFn: EnumFunction): RootDollar {
  return {
    enum: enumFn,
    select(selection) {
      const dollar = createFieldDollar(enumFn)
      dollar._selection = selection
      return dollar
    },
  }
}
