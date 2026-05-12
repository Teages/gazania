<script lang="ts">
export const MediaContentFragment = schema.partial('MediaContent_Media')
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
</script>

<script setup lang="ts">
const { media: mediaRaw } = defineProps<{
  media: FragmentOf<typeof MediaContentFragment>
}>()

const media = computed(() => readFragment(MediaContentFragment, mediaRaw))
</script>

<template>
  <div>
    {{ media }}
  </div>
</template>
