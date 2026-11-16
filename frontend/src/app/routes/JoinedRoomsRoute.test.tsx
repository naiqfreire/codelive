import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth'
import type { JoinedRoom, RoomsApi } from '../../features/rooms'
import { ApiError } from '../../shared/http'
import { TEST_USER, createFakeAuthApi } from '../../test/auth'
import { QueryProvider } from '../../test/query'
import JoinedRoomsRoute from './JoinedRoomsRoute'

const joinedRoom: JoinedRoom = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
  joinedAt: '2026-11-11T10:00:00Z',
}

function createFakeRoomsApi(overrides: Partial<RoomsApi> = {}): RoomsApi {
  return {
    listMine: vi.fn(async () => []),
    listJoined: vi.fn(async () => [joinedRoom]),
    create: vi.fn(async () => joinedRoom),
    close: vi.fn(async () => joinedRoom),
    regenerateCode: vi.fn(async () => joinedRoom),
    getByCode: vi.fn(async () => ({
      ...joinedRoom,
      ownerId: TEST_USER.id,
      updatedAt: joinedRoom.createdAt,
    })),
    ...overrides,
  }
}

function renderRoute(api: RoomsApi = createFakeRoomsApi(), logout = vi.fn(async () => undefined)) {
  return render(
    <QueryProvider>
      <AuthProvider api={createFakeAuthApi({ logout })}>
        <MemoryRouter initialEntries={['/rooms/joined']}>
          <JoinedRoomsRoute api={api} />
        </MemoryRouter>
      </AuthProvider>
    </QueryProvider>,
  )
}

describe('JoinedRoomsRoute', () => {
  it('loads the rooms the user joined as a spectator', async () => {
    const api = createFakeRoomsApi()
    renderRoute(api)

    expect(await screen.findByRole('heading', { name: 'K7M2QX' })).toBeInTheDocument()
    expect(api.listJoined).toHaveBeenCalledTimes(1)
  })

  it('ends the session when the list is rejected with 401', async () => {
    const logout = vi.fn(async () => undefined)
    const api = createFakeRoomsApi({
      listJoined: vi.fn(async () => {
        throw new ApiError(401, 'not_authenticated', 'Não autenticado.', 'req-1')
      }),
    })
    renderRoute(api, logout)

    fireEvent.click(await screen.findByRole('button', { name: /entrar novamente/i }))

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
  })
})
