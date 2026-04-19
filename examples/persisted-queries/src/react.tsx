import { createClient } from '@teages/oh-my-graphql'
import { createGazania } from 'gazania'
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'

const API = 'https://graphql-test.teages.xyz/graphql-user-apq'
const client = createClient(API, { persistedQueries: { autoRetry: true } })
const gazania = createGazania(API)

const GetUsersQuery = gazania.query('GetUsers_React').select($ =>
  $.select([
    {
      users: $ => $.select(['id', 'name']),
    },
  ]),
)

interface User {
  id: string
  name: string
}

function App() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await client.request(GetUsersQuery)
        setUsers((data as { users?: User[] }).users ?? [])
      }
      catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
      finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Gazania Persisted Queries (React)</h1>
      {loading
        ? (
            <p>Loading users…</p>
          )
        : error
          ? (
              <p style={{ color: '#c53030' }}>{error}</p>
            )
          : (
              <ul>
                {users.map(user => (
                  <li key={user.id}>
                    {user.name}
                    {' '}
                    <small>
                      (
                      {user.id}
                      )
                    </small>
                  </li>
                ))}
              </ul>
            )}
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
