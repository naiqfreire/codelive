import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth'
import type { RoomLookup, RoomsApi } from '../../features/rooms'
import { ApiError } from '../../shared/http'
import { createFakeAuthApi } from '../../test/auth'
import CodeEntryRoute from './CodeEntryRoute'

const room: RoomLookup = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
  ownerId: '22222222-2222-2222-2222-222222222222',
  updatedAt: '2026-11-10T10:00:00Z',
}

function createFakeRoomsApi(overrides: Partial<RoomsApi> = {}): RoomsApi {
  return {
    listMine: async () => [],
    create: async () => room,
    close: async () => room,
    regenerateCode: async () => room,
    getByCode: vi.fn(async () => room),
    ...overrides,
  }
}

function IdentificationStub() {
  const { roomId } = useParams()
  return <p>identificação {roomId}</p>
}

function renderRoute({
  api = createFakeRoomsApi(),
  authApi = createFakeAuthApi(),
  state,
}: {
  api?: RoomsApi
  authApi?: ReturnType<typeof createFakeAuthApi>
  state?: unknown
} = {}) {
  return render(
    <AuthProvider api={authApi}>
      <MemoryRouter initialEntries={[{ pathname: '/rooms/join', state }]}>
        <Routes>
          <Route path="/rooms/join" element={<CodeEntryRoute api={api} />} />
          <Route path="/rooms/:roomId/join" element={<IdentificationStub />} />
          <Route path="/login" element={<p>tela de login</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('CodeEntryRoute', () => {
  it('validates the code and redirects to the identification step', async () => {
    const api = createFakeRoomsApi()
    renderRoute({ api })

    fireEvent.change(screen.getByLabelText(/código de acesso/i), {
      target: { value: 'k7-m2qx' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText(`identificação ${room.id}`)).toBeInTheDocument()
    expect(api.getByCode).toHaveBeenCalledWith('K7M2QX')
  })

  it('prefills the field with the code carried by navigation state', () => {
    renderRoute({ state: { code: 'k7m2qx' } })

    expect(screen.getByLabelText(/código de acesso/i)).toHaveValue('K7M2QX')
  })

  it('does not redirect when the room is closed', async () => {
    const api = createFakeRoomsApi({
      getByCode: vi.fn(async () => ({ ...room, status: 'closed' as const })),
    })
    renderRoute({ api })

    fireEvent.change(screen.getByLabelText(/código de acesso/i), {
      target: { value: 'K7M2QX' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(
      await screen.findByText('Esta sala já foi encerrada. Peça um novo código ao dono.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/identificação/i)).not.toBeInTheDocument()
  })

  it('logs out and goes to the login page when the session expired', async () => {
    const logout = vi.fn(async () => undefined)
    const api = createFakeRoomsApi({
      getByCode: vi.fn(async () => {
        throw new ApiError(401, 'not_authenticated', 'Não autenticado.', 'req-1')
      }),
    })
    renderRoute({ api, authApi: createFakeAuthApi({ logout }) })

    fireEvent.change(screen.getByLabelText(/código de acesso/i), {
      target: { value: 'K7M2QX' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Entrar novamente' }))

    expect(await screen.findByText('tela de login')).toBeInTheDocument()
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
