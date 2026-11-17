import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth'
import type { AuthApi } from '../../features/auth'
import type { JoinedRoom, RoomSummary, RoomsApi } from '../../features/rooms'
import { ApiError } from '../../shared/http'
import { anonymousAuthError, TEST_USER, createFakeAuthApi } from '../../test/auth'
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

const summaryRoom: RoomSummary = {
  id: joinedRoom.id,
  accessCode: joinedRoom.accessCode,
  language: joinedRoom.language,
  status: joinedRoom.status,
  createdAt: joinedRoom.createdAt,
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
    join: vi.fn(async () => joinedRoom),
    ...overrides,
  }
}

function renderRoute(
  api: RoomsApi = createFakeRoomsApi(),
  roomId = joinedRoom.id,
  options: { authApi?: AuthApi; state?: unknown } = {},
) {
  return render(
    <QueryProvider>
      <AuthProvider api={options.authApi ?? createFakeAuthApi()}>
        <MemoryRouter
          initialEntries={[{ pathname: `/rooms/${roomId}/view`, state: options.state }]}
        >
          <Routes>
            <Route path="/rooms/:roomId/view" element={<SpectatorRoomRoute api={api} />} />
            <Route path="/rooms/join" element={<p>tela do código</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryProvider>,
  )
}

function anonymousApi(): AuthApi {
  return createFakeAuthApi({
    me: async () => {
      throw anonymousAuthError()
    },
  })
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

  it('opens the room from the navigation state for an anonymous visitor', async () => {
    const api = createFakeRoomsApi()
    renderRoute(api, joinedRoom.id, {
      authApi: anonymousApi(),
      state: { room: summaryRoom },
    })

    expect(await screen.findByRole('heading', { name: /sala ao vivo/i })).toBeInTheDocument()
    expect(screen.getByText('K7M2QX')).toBeInTheDocument()
    expect(api.listJoined).not.toHaveBeenCalled()
  })

  it('keeps the anonymous spectator in read-only mode', async () => {
    renderRoute(createFakeRoomsApi(), joinedRoom.id, {
      authApi: anonymousApi(),
      state: { room: summaryRoom },
    })

    expect(
      await screen.findByText(/somente o dono da sala pode editar/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /código da sala/i })).toHaveAttribute(
      'contenteditable',
      'false',
    )
  })

  it('asks the anonymous visitor for the code when the state is missing', async () => {
    renderRoute(createFakeRoomsApi(), joinedRoom.id, { authApi: anonymousApi() })

    expect(await screen.findByText(/sala não encontrada/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /informar o código/i })).toHaveAttribute(
      'href',
      '/rooms/join',
    )
  })

  it('asks the anonymous visitor for the code when the state belongs to another room', async () => {
    renderRoute(createFakeRoomsApi(), '33333333-3333-3333-3333-333333333333', {
      authApi: anonymousApi(),
      state: { room: summaryRoom },
    })

    expect(await screen.findByText(/sala não encontrada/i)).toBeInTheDocument()
  })
})
