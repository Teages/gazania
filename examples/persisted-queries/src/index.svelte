<script lang="ts">
  import { onMount } from 'svelte'
  import { createClient } from '@teages/oh-my-graphql'
  import { createGazania } from 'gazania'

  const API = 'https://graphql-test.teages.xyz/graphql-user-apq'
  const client = createClient(API, { persistedQueries: { autoRetry: true } })
  const gazania = createGazania(API)

  let users: Array<{ id: string; name: string }> = []
  let loading = true
  let error: string | null = null

  const GetUsersQuery = gazania.query('GetUsers_Svelte').select($ =>
    $.select([
      {
        users: $ => $.select(['id', 'name']),
      },
    ]),
  )

  onMount(async () => {
    try {
      const data = await client.request(GetUsersQuery)
      users = (data as { users?: Array<{ id: string; name: string }> }).users ?? []
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      loading = false
    }
  })
</script>

<main>
  <h1>Gazania Persisted Queries (Svelte)</h1>

  {#if loading}
    <p>Loading users…</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <ul>
      {#each users as user}
        <li>{user.name} <small>({user.id})</small></li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main {
    max-width: 42rem;
    margin: 0 auto;
    padding: 2rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .error {
    color: #c53030;
  }
</style>
