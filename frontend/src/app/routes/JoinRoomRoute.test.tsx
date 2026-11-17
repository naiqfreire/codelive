import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth'
import type { AuthApi } from '../../features/auth'
import type { RoomLookup, RoomSummary, RoomsApi } from '../../features/rooms'
import { ApiError } from '../../shared/http'
import { anonymousAuthError, createFakeAuthApi } from '../../test/auth'
import { QueryProvider } from '../../test/query'
import JoinRoomRoute from './JoinRoomRoute'

const room: RoomLookup = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'java',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
  ownerId: '22222222-2222-2222-2222-222222222222',
  updatedAt: '2026-11-10T10:00:00Z',
}

const joined: RoomSummary = {
  id: room.id,
  accessCode: room.accessCode,
  language: room.language,
  status: room.status,
  createdAt: room.createdAt,
}

function createFakeRoomsApi(overrides: Partial<RoomsApi> = {}): RoomsApi {
  return {
    listMine: vi.fn(async () => []),
    listJoined: vi.fn(async () => []),
    create: vi.fn(async () => joined),
    close: vi.fn(async () => joined),
    regenerateCode: vi.fn(async () => joined),
    getByCode: vi.fn(async () => room),
    join: vi.fn(async () => joined),
    ...overrides,
  }
}

function CodeEntryStub() {
  const location = useLocation()
  const code = (location.state as { code?: string } | null)?.code ?? 'sem código'
  return <p>tela do código: {code}</p>
}

function ViewStub() {
  const { roomId } = useParams()
  const location = useLocation()
  const stateRoom = (location.state as { room?: RoomSummary } | null)?.room
  return (
    <p>
      sala {roomId}: {stateRoom?.accessCode ?? 'sem sala'}
    </p>
  )
}

function renderRoute({
  state,
  roomId = room.id,
  api = createFakeRoomsApi(),
  authApi = createFakeAuthApi(),
}: {
  state?: unknown
  roomId?: string
  api?: RoomsApi
  authApi?: AuthApi
} = {}) {
  render(
    <QueryProvider>
      <AuthProvider api={authApi}>
        <MemoryRouter initialEntries={[{ pathname: `/rooms/${roomId}/join`, state }]}>
          <Routes>
            <Route path="/rooms/join" element={<CodeEntryStub />} />
            <Route path="/rooms/:roomId/join" element={<JoinRoomRoute api={api} />} />
            <Route path="/rooms/:roomId/view" element={<ViewStub />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryProvider>,
  )

  return api
}

function anonymousAuthApi(): AuthApi {
  return createFakeAuthApi({
    me: async () => {
      throw anonymousAuthError()
    },
  })
}

function fillAndSubmit(label: RegExp | string) {
  fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: '  Ana  ' } })
  fireEvent.click(screen.getByRole('button', { name: label }))
}

describe('JoinRoomRoute', () => {
  it('renders the identification step when the navigation state carries the room', async () => {
    renderRoute({ state: { room } })

    expect(await screen.findByText('Passo 3 de 4')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Identificação' })).toBeInTheDocument()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('sends an anonymous join from a visitor without an account', async () => {
    const api = renderRoute({ state: { room }, authApi: anonymousAuthApi() })

    expect(await screen.findByRole('button', { name: 'Entrar sem conta' })).toBeInTheDocument()

    fillAndSubmit('Entrar sem conta')

    await waitFor(() =>
      expect(api.join).toHaveBeenCalledWith(room.id, {
        code: room.accessCode,
        anonymous: true,
        nickname: 'Ana',
      }),
    )
    expect(await screen.findByText(`sala ${room.id}: K7M2QX`)).toBeInTheDocument()
  })

  it('sends an authenticated join with the account identity', async () => {
    const api = renderRoute({ state: { room } })

    expect(await screen.findByRole('button', { name: 'Entrar na sala' })).toBeInTheDocument()

    fillAndSubmit('Entrar na sala')

    await waitFor(() =>
      expect(api.join).toHaveBeenCalledWith(room.id, {
        code: room.accessCode,
        anonymous: false,
        nickname: 'Ana',
      }),
    )
    expect(await screen.findByText(`sala ${room.id}: K7M2QX`)).toBeInTheDocument()
  })

  it('shows the joined room from the API instead of the previous metadata', async () => {
    const updated = { ...joined, accessCode: 'B4T9RS' }
    renderRoute({
      state: { room },
      api: createFakeRoomsApi({ join: vi.fn(async () => updated) }),
    })

    await screen.findByRole('button', { name: 'Entrar na sala' })
    fillAndSubmit('Entrar na sala')

    expect(await screen.findByText(`sala ${room.id}: B4T9RS`)).toBeInTheDocument()
  })

  it('keeps the modal and shows a closed-room error', async () => {
    renderRoute({
      state: { room },
      api: createFakeRoomsApi({
        join: vi.fn(async () => {
          throw new ApiError(409, 'room_closed', 'Sala encerrada.', 'req-1')
        }),
      }),
    })

    await screen.findByRole('button', { name: 'Entrar na sala' })
    fillAndSubmit('Entrar na sala')

    expect(
      await screen.findByText('Esta sala já foi encerrada. Peça um novo código ao dono.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('disables the action while the join request is in flight', async () => {
    let resolveJoin: (value: RoomSummary) => void = () => undefined
    const join = vi.fn(
      () =>
        new Promise<RoomSummary>((resolve) => {
          resolveJoin = resolve
        }),
    )
    renderRoute({ state: { room }, api: createFakeRoomsApi({ join }) })

    await screen.findByRole('button', { name: 'Entrar na sala' })
    fillAndSubmit('Entrar na sala')

    expect(await screen.findByRole('button', { name: /entrando/i })).toBeDisabled()
    expect(screen.getByLabelText(/nickname/i)).toBeDisabled()

    resolveJoin(joined)

    expect(await screen.findByText(`sala ${room.id}: K7M2QX`)).toBeInTheDocument()
  })

  it('closes the modal and returns to the code step with the code preserved', async () => {
    renderRoute({ state: { room } })

    fireEvent.click(await screen.findByRole('button', { name: 'Fechar' }))

    expect(screen.getByText('tela do código: K7M2QX')).toBeInTheDocument()
  })

  it('asks for the code when the navigation state is missing', async () => {
    renderRoute()

    expect(await screen.findByRole('heading', { name: /código necessário/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks for the code when the state belongs to another room', async () => {
    renderRoute({ state: { room }, roomId: '33333333-3333-3333-3333-333333333333' })

    expect(await screen.findByRole('heading', { name: /código necessário/i })).toBeInTheDocument()
  })

  it('blocks a closed room resolved by the previous step', async () => {
    renderRoute({ state: { room: { ...room, status: 'closed' } } })

    expect(await screen.findByRole('heading', { name: /sala encerrada/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
