import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth'
import type { JoinedRoom, RoomsApi } from '../../features/rooms'
import { ApiError } from '../../shared/http'
import { TEST_USER, createFakeAuthApi } from '../../test/auth'
import { QueryProvider } from '../../test/query'
import { installSilentWebSocket } from '../../test/websocket'
import SpectatorRoomRoute from './SpectatorRoomRoute'

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

function renderRoute(api: RoomsApi = createFakeRoomsApi(), roomId = joinedRoom.id) {
  return render(
    <QueryProvider>
      <AuthProvider api={createFakeAuthApi()}>
        <MemoryRouter initialEntries={[`/rooms/${roomId}/view`]}>
          <Routes>
            <Route path="/rooms/:roomId/view" element={<SpectatorRoomRoute api={api} />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryProvider>,
  )
}

beforeEach(() => {
  installSilentWebSocket()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SpectatorRoomRoute', () => {
  it('resolves a joined room from the API after a reload', async () => {
    const api = createFakeRoomsApi()
    renderRoute(api)

    expect(await screen.findByRole('heading', { name: /sala ao vivo/i })).toBeInTheDocument()
    expect(screen.getByText('K7M2QX')).toBeInTheDocument()
    expect(api.listJoined).toHaveBeenCalledTimes(1)
  })

  it('renders a read-only editor while waiting for the snapshot', async () => {
    renderRoute()

    const editor = await screen.findByRole('textbox', { name: /código da sala/i })
    expect(editor).toHaveAttribute('contenteditable', 'false')
  })

  it('shows the not-found state when the user has not joined the room', async () => {
    renderRoute(createFakeRoomsApi(), '00000000-0000-0000-0000-000000000000')

    expect(await screen.findByText(/sala não encontrada/i)).toBeInTheDocument()
  })

  it('shows the load error and retries', async () => {
    const listJoined = vi
      .fn<RoomsApi['listJoined']>()
      .mockRejectedValueOnce(new ApiError(500, 'internal_error', 'Falha.', 'req-1'))
      .mockResolvedValueOnce([joinedRoom])
    renderRoute(createFakeRoomsApi({ listJoined }))

    expect(await screen.findByText(/não foi possível abrir a sala/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await waitFor(() => expect(listJoined).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('heading', { name: /sala ao vivo/i })).toBeInTheDocument()
  })
})
