<script setup lang="ts">
import { MediaContentFragment } from '~/components/MediaContent.vue'

const query = schema.query('FetchAnime')
  .vars({ id: 'Int = 127549' })
  .select(($, vars) => $.select([{
    Media: $ => $.args({ id: vars.id, type: schema.enum('ANIME') })
      .select([
        'id',
        ...MediaContentFragment(vars),
      ]),
  }]))

const { data, error } = useAsyncData(() => client.request(query, { }))
</script>

<template>
  <div>
    Media:
    <div v-if="error">
      {{ error.message }}
    </div>
    <MediaContent v-else-if="data?.Media" :media="data.Media" />
    <div v-else>
      Loading...
    </div>
  </div>
</template>
