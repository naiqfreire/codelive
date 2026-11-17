import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth'
import type { RoomSummary, RoomsApi } from '../../features/rooms'
import { ApiError } from '../../shared/http'
import { TEST_USER, createFakeAuthApi } from '../../test/auth'
import { QueryProvider } from '../../test/query'
import { installSilentWebSocket } from '../../test/websocket'
import OwnerRoomRoute from './OwnerRoomRoute'

const room: RoomSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
}

function createFakeRoomsApi(overrides: Partial<RoomsApi> = {}): RoomsApi {
  return {
    listMine: vi.fn(async () => [room]),
    listJoined: vi.fn(async () => []),
    create: vi.fn(async () => room),
    close: vi.fn(async () => room),
    regenerateCode: vi.fn(async () => room),
    getByCode: vi.fn(async () => ({
      ...room,
      ownerId: TEST_USER.id,
      updatedAt: room.createdAt,
    })),
    join: vi.fn(async () => room),
    ...overrides,
  }
}

function renderRoute(api: RoomsApi = createFakeRoomsApi(), roomId = room.id) {
  return render(
    <QueryProvider>
      <AuthProvider api={createFakeAuthApi()}>
        <MemoryRouter initialEntries={[`/rooms/${roomId}`]}>
          <Routes>
            <Route path="/rooms/:roomId" element={<OwnerRoomRoute api={api} />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryProvider>,
  )
}

beforeEach(() => {
  installSilentWebSocket()
  // The version panel resolves its own query; it must not reach the network.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OwnerRoomRoute', () => {
  it('resolves the room from the API after a reload', async () => {
    const api = createFakeRoomsApi()
    renderRoute(api)

    expect(await screen.findByRole('heading', { name: /sua sala/i })).toBeInTheDocument()
    expect(screen.getByText('K7M2QX')).toBeInTheDocument()
    expect(api.listMine).toHaveBeenCalledTimes(1)
  })

  it('keeps the editor locked until the snapshot arrives', async () => {
    renderRoute()

    expect(await screen.findByRole('textbox', { name: /editor de código/i })).toHaveAttribute(
      'contenteditable',
      'false',
    )
  })

  it('shows the not-found state when the room is not in the list', async () => {
    renderRoute(createFakeRoomsApi(), '00000000-0000-0000-0000-000000000000')

    expect(await screen.findByText(/sala não encontrada/i)).toBeInTheDocument()
  })

  it('shows the load error and retries', async () => {
    const listMine = vi
      .fn<RoomsApi['listMine']>()
      .mockRejectedValueOnce(new ApiError(500, 'internal_error', 'Falha.', 'req-1'))
      .mockResolvedValueOnce([room])
    renderRoute(createFakeRoomsApi({ listMine }))

    expect(await screen.findByText(/não foi possível abrir a sala/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await waitFor(() => expect(listMine).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('heading', { name: /sua sala/i })).toBeInTheDocument()
  })
})
