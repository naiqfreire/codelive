import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth'
import type { RoomsApi } from '../../features/rooms'
import { ApiError } from '../../shared/http'
import { TEST_USER, createFakeAuthApi } from '../../test/auth'
import { QueryProvider } from '../../test/query'
import RoomListRoute from './RoomListRoute'
import type { RoomSummary } from '../../features/rooms'

const room: RoomSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
}

function createFakeRoomsApi(overrides: Partial<RoomsApi> = {}): RoomsApi {
  let rooms: RoomSummary[] = [room]

  return {
    listMine: vi.fn(async () => rooms),
    create: vi.fn(async (language) => {
      const created: RoomSummary = {
        ...room,
        id: '22222222-2222-2222-2222-222222222222',
        accessCode: 'H5P1VC',
        language,
      }
      rooms = [created, ...rooms]
      return created
    }),
    close: vi.fn(async (roomId) => {
      const closed = rooms.find((item) => item.id === roomId) ?? room
      const updated: RoomSummary = { ...closed, status: 'closed' }
      rooms = rooms.map((item) => (item.id === roomId ? updated : item))
      return updated
    }),
    regenerateCode: vi.fn(async (roomId) => {
      const current = rooms.find((item) => item.id === roomId) ?? room
      const updated: RoomSummary = { ...current, accessCode: 'N4W7XZ' }
      rooms = rooms.map((item) => (item.id === roomId ? updated : item))
      return updated
    }),
    getByCode: vi.fn(async () => ({
      ...room,
      ownerId: TEST_USER.id,
      updatedAt: room.createdAt,
    })),
    ...overrides,
  }
}

function renderRoute(api: RoomsApi = createFakeRoomsApi()) {
  return render(
    <QueryProvider>
      <AuthProvider api={createFakeAuthApi()}>
        <MemoryRouter initialEntries={['/rooms']}>
          <RoomListRoute api={api} />
        </MemoryRouter>
      </AuthProvider>
    </QueryProvider>,
  )
}

describe('RoomListRoute', () => {
  it('loads the rooms of the authenticated user', async () => {
    const api = createFakeRoomsApi()
    renderRoute(api)

    expect(await screen.findByRole('heading', { name: 'K7M2QX' })).toBeInTheDocument()
    expect(api.listMine).toHaveBeenCalledTimes(1)
  })

  it('creates a room through the API and shows it in the list', async () => {
    const api = createFakeRoomsApi()
    renderRoute(api)

    await screen.findByRole('heading', { name: 'K7M2QX' })
    fireEvent.click(screen.getByRole('button', { name: 'Nova sala' }))
    fireEvent.change(screen.getByLabelText(/linguagem/i), { target: { value: 'java' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    await waitFor(() => expect(api.create).toHaveBeenCalledWith('java'))
    expect(await screen.findByRole('heading', { name: 'H5P1VC' })).toBeInTheDocument()
  })

  it('closes a room through the API and updates the card', async () => {
    const api = createFakeRoomsApi()
    renderRoute(api)

    fireEvent.click(await screen.findByRole('button', { name: /encerrar sala k7m2qx/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Encerrar sala' }))

    await waitFor(() => expect(api.close).toHaveBeenCalledWith(room.id))
    expect(await screen.findByText('Encerrada')).toBeInTheDocument()
  })

  it('regenerates the access code through the API', async () => {
    const api = createFakeRoomsApi()
    renderRoute(api)

    fireEvent.click(await screen.findByRole('button', { name: /regenerar código k7m2qx/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerar código' }))

    await waitFor(() => expect(api.regenerateCode).toHaveBeenCalledWith(room.id))
    expect(
      await screen.findByRole('heading', { name: 'N4W7XZ' }),
    ).toBeInTheDocument()
  })

  it('shows the load error and retries', async () => {
    const listMine = vi
      .fn<RoomsApi['listMine']>()
      .mockRejectedValueOnce(new ApiError(500, 'internal_error', 'Erro.', 'req-1'))
      .mockResolvedValueOnce([room])
    const api = createFakeRoomsApi({ listMine })
    renderRoute(api)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível carregar suas salas/i,
    )

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(await screen.findByRole('heading', { name: 'K7M2QX' })).toBeInTheDocument()
    expect(listMine).toHaveBeenCalledTimes(2)
  })

  it('flags an expired session', async () => {
    const listMine = vi
      .fn<RoomsApi['listMine']>()
      .mockRejectedValue(new ApiError(401, 'not_authenticated', 'Não autenticado.', 'req-1'))
    renderRoute(createFakeRoomsApi({ listMine }))

    expect(
      await screen.findByRole('button', { name: /entrar novamente/i }),
    ).toBeInTheDocument()
    expect(TEST_USER.id).toBeTruthy()
  })
})