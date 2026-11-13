import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthProvider, useAuth } from '../features/auth'
import { TEST_USER, createFakeAuthApi } from '../test/auth'
import { QUERY_CACHE_KEY } from './queryClient'
import { SessionCacheBoundary } from './SessionCacheBoundary'

function Harness() {
  const { user, logout } = useAuth()

  return (
    <div>
      <SessionCacheBoundary />
      <span>{user?.name ?? 'sem usuário'}</span>
      <button type="button" onClick={() => void logout()}>
        Sair
      </button>
    </div>
  )
}

function renderBoundary(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={createFakeAuthApi()}>
        <Harness />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('SessionCacheBoundary', () => {
  it('keeps a restored cache while the session loads', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['rooms', 'mine', TEST_USER.id], [{ id: 'room-1' }])

    renderBoundary(queryClient)

    expect(await screen.findByText(TEST_USER.name)).toBeInTheDocument()
    expect(queryClient.getQueryData(['rooms', 'mine', TEST_USER.id])).toEqual([{ id: 'room-1' }])
  })

  it('clears the memory and the stored cache after logout', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['rooms', 'mine', TEST_USER.id], [{ id: 'room-1' }])
    localStorage.setItem(QUERY_CACHE_KEY, '{"clientState":{"mutations":[],"queries":[]}}')

    renderBoundary(queryClient)

    expect(await screen.findByText(TEST_USER.name)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^sair$/i }))

    await waitFor(() => {
      expect(queryClient.getQueryData(['rooms', 'mine', TEST_USER.id])).toBeUndefined()
    })
    expect(localStorage.getItem(QUERY_CACHE_KEY)).toBeNull()
  })
})
