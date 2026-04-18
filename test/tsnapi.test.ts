import { fileURLToPath } from 'node:url'
import { snapshotApiPerEntry } from 'tsnapi/vitest'
import { describe } from 'vitest'

const dir = fileURLToPath(new URL('..', import.meta.url))

describe('gazania export api', async () => {
  await snapshotApiPerEntry(dir)
})
