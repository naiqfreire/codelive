import { useMemo } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './features/auth'
import { router } from './app/router'
import { SessionCacheBoundary } from './app/SessionCacheBoundary'
import { createPersistOptions, createQueryClient, createQueryPersister } from './app/queryClient'

export default function App() {
  const queryClient = useMemo(createQueryClient, [])
  const persister = useMemo(createQueryPersister, [])
  const persistOptions = useMemo(
    () => (persister ? createPersistOptions(persister) : null),
    [persister],
  )

  const content = (
    <AuthProvider>
      <SessionCacheBoundary />
      <RouterProvider router={router} />
    </AuthProvider>
  )

  if (!persistOptions) {
    return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {content}
    </PersistQueryClientProvider>
  )
}
