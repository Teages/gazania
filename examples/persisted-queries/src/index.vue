<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createClient } from '@teages/oh-my-graphql'
import { createGazania } from 'gazania'

const API = 'https://graphql-test.teages.xyz/graphql-user-apq'
const client = createClient(API, { persistedQueries: { autoRetry: true } })
const gazania = createGazania(API)

const users = ref<Array<{ id: string; name: string }>>([])
const loading = ref(true)
const error = ref<string | null>(null)

const GetUsersQuery = gazania.query('GetUsers_Vue').select($ =>
  $.select([
    {
      users: $ => $.select(['id', 'name']),
    },
  ]),
)

onMounted(async () => {
  try {
    const data = await client.request(GetUsersQuery)
    users.value = (data as { users?: Array<{ id: string; name: string }> }).users ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main>
    <h1>Gazania Persisted Queries (Vue)</h1>
    <section>
      <p v-if="loading">Loading users…</p>
      <p v-else-if="error" class="error">{{ error }}</p>
      <ul v-else>
        <li v-for="user in users" :key="user.id">
          {{ user.name }} <small>({{ user.id }})</small>
        </li>
      </ul>
    </section>
  </main>
</template>
