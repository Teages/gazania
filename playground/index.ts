/* eslint-disable no-console */
/* eslint-disable antfu/no-top-level-await */

import type { FragmentOf } from 'gazania'
import { createClient } from '@teages/oh-my-graphql'
import { createGazania, readFragment } from 'gazania'
import { print } from 'graphql'

const endpoint = 'https://graphql.anilist.co'
const schema = createGazania(endpoint)

const client = createClient(endpoint)

const MediaFragment = schema.partial('MediaFragment')
  .on('Media')
  .select($ => $.select([
    'id',
    {
      title: $ => $.select([
        'romaji',
        'english',
        'native',
      ]),
    },
  ]))

const query = schema.query('FetchAnime')
  .vars({ id: 'Int = 127549' })
  .select(($, vars) => $.select([{
    Media: $ => $.args({ id: vars.id, type: schema.enum('ANIME') })
      .select([
        'id',
        ...MediaFragment(vars),
      ]),
  }]))

function printResult(data: { media?: FragmentOf<typeof MediaFragment> | null }) {
  const media = readFragment(MediaFragment, data.media)
  if (!media) {
    console.log('Media not found')
    return
  }
  console.log('Media ID:', media.id)
  console.log('Title:')
  console.log('  Romaji:', media.title?.romaji || 'N/A')
  console.log('  English:', media.title?.english || 'N/A')
  console.log('  Native:', media.title?.native || 'N/A')
}

console.log(`${'```graphql'}
${print(query)}
${'```'}`)

const res = await client.request(query, { })
printResult({ media: res.Media })
