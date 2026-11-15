import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { JoinedRoom, RoomLanguage, RoomListItem, RoomSummary } from '../../features/rooms'
import RoomListPage from './RoomListPage'

const activeRoom: RoomSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
}

const secondRoom: RoomSummary = {
  id: '22222222-2222-2222-2222-222222222222',
  accessCode: 'B4T9RS',
  language: 'java',
  status: 'active',
  createdAt: '2026-11-08T17:30:00Z',
}

const closedRoom: RoomSummary = {
  id: '33333333-3333-3333-3333-333333333333',
  accessCode: 'Z2Y8NM',
  language: 'javascript',
  status: 'closed',
  createdAt: '2026-11-07T17:30:00Z',
}

const createdRoom: RoomSummary = {
  ...activeRoom,
  id: '44444444-4444-4444-4444-444444444444',
  accessCode: 'H5P1VC',
  language: 'java',
}

const joinedActiveRoom: JoinedRoom = {
  ...activeRoom,
  joinedAt: '2026-11-10T09:00:00Z',
}

const joinedClosedRoom: JoinedRoom = {
  ...closedRoom,
  joinedAt: '2026-11-11T10:00:00Z',
}

type PageProps = {
  tab?: 'mine' | 'joined'
  rooms?: RoomListItem[]
  isLoading?: boolean
  errorMessage?: string | null
  isSessionExpired?: boolean
  onRetry?: () => void
  onCreateRoom?: (language: RoomLanguage) => Promise<RoomSummary>
  onCloseRoom?: (room: RoomSummary) => Promise<RoomSummary>
  onRegenerateCode?: (room: RoomSummary) => Promise<RoomSummary>
}

function renderPage(overrides: PageProps = {}) {
  const props = {
    tab: 'mine' as const,
    rooms: [activeRoom, secondRoom, closedRoom] as RoomListItem[],
    isLoading: false,
    errorMessage: null,
    isSessionExpired: false,
    onRetry: vi.fn(),
    onCreateRoom: vi.fn(async (language: RoomLanguage) => ({ ...createdRoom, language })),
    onCloseRoom: vi.fn(async (room: RoomSummary) => ({ ...room, status: 'closed' as const })),
    onRegenerateCode: vi.fn(async (room: RoomSummary) => ({ ...room, accessCode: 'N4W7XZ' })),
    ...overrides,
  }

  const router = createMemoryRouter([{ path: '/rooms', element: <RoomListPage {...props} /> }], {
    initialEntries: ['/rooms'],
  })

  return { ...render(<RouterProvider router={router} />), props }
}

describe('RoomListPage', () => {
  it('renders one card per room', async () => {
    renderPage()

    expect(await screen.findAllByRole('heading', { level: 2 })).toHaveLength(3)
  })

  it('renders the room tabs with the owner tab active by default', async () => {
    renderPage()

    expect(
      await screen.findByRole('navigation', { name: /filtro de salas/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criadas por mim' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Participei' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Nova sala' })).toBeInTheDocument()
  })

  it('titles the joined tab and renders spectator cards without management actions', async () => {
    renderPage({ tab: 'joined', rooms: [joinedActiveRoom, joinedClosedRoom] })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Salas que participei' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Participei' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: /assistir k7m2qx/i })).toHaveAttribute(
      'href',
      `/rooms/${activeRoom.id}/view`,
    )
    expect(screen.getAllByText(/entrou em 10\/11\/2026/i)).toHaveLength(1)
    expect(screen.getByText(/entrou em 11\/11\/2026/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nova sala' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /encerrar sala/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /regenerar código/i })).not.toBeInTheDocument()
  })

  it('does not offer a link to a closed joined room', async () => {
    renderPage({ tab: 'joined', rooms: [joinedClosedRoom] })

    expect(await screen.findByRole('heading', { name: 'Z2Y8NM' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /z2y8nm/i })).not.toBeInTheDocument()
    expect(screen.getByText('Encerrada')).toBeInTheDocument()
  })

  it('shows the joined empty state without a create action', async () => {
    renderPage({ tab: 'joined', rooms: [] })

    expect(await screen.findByText(/ainda não participou de nenhuma sala/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /criar sala/i })).not.toBeInTheDocument()
  })

  it('summarizes the open and closed counts', async () => {
    renderPage()

    expect(await screen.findByText(/2 abertas/)).toBeInTheDocument()
    expect(screen.getByText(/1 encerrada/)).toBeInTheDocument()
  })

  it('shows the empty state with a create action', async () => {
    renderPage({ rooms: [] })

    expect(await screen.findByText(/nenhuma sala ainda/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /criar sala/i })).toBeInTheDocument()
  })

  it('announces loading with a status role', async () => {
    renderPage({ rooms: [], isLoading: true })

    expect(await screen.findByRole('status')).toHaveTextContent(/carregando salas/i)
  })

  it('shows the error state with retry when there is no cached data', async () => {
    const onRetry = vi.fn()
    renderPage({ rooms: [], errorMessage: 'Falhou ao carregar.', onRetry })

    expect(await screen.findByRole('alert')).toHaveTextContent('Falhou ao carregar.')
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers a new login when the session expired', async () => {
    renderPage({
      rooms: [],
      errorMessage: 'Sua sessão expirou. Entre novamente.',
      isSessionExpired: true,
    })

    expect(await screen.findByRole('button', { name: /entrar novamente/i })).toBeInTheDocument()
  })

  it('keeps the cached list and shows a refresh banner on error', async () => {
    renderPage({ errorMessage: 'Não foi possível atualizar a lista.' })

    expect(await screen.findByRole('heading', { name: 'K7M2QX' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível atualizar a lista/i)
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it('creates a room with the chosen language', async () => {
    const { props } = renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Nova sala' }))
    fireEvent.change(screen.getByLabelText(/linguagem/i), { target: { value: 'java' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    await waitFor(() => expect(props.onCreateRoom).toHaveBeenCalledWith('java'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText(/sala criada\. código de acesso h5p1vc\./i)).toBeInTheDocument()
  })

  it('keeps the create dialog open and shows the failure', async () => {
    const onCreateRoom = vi.fn(async () => {
      throw new Error('boom')
    })
    renderPage({ onCreateRoom })

    fireEvent.click(await screen.findByRole('button', { name: 'Nova sala' }))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível criar a sala/i)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('confirms the room closing before calling the API', async () => {
    const { props } = renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /encerrar sala k7m2qx/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName('Encerrar sala K7M2QX?')

    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sala' }))

    await waitFor(() => expect(props.onCloseRoom).toHaveBeenCalledWith(activeRoom))
    expect(await screen.findByText('Sala K7M2QX encerrada.')).toBeInTheDocument()
  })

  it('does not close the room when the confirmation is cancelled', async () => {
    const { props } = renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /encerrar sala k7m2qx/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(props.onCloseRoom).not.toHaveBeenCalled()
  })

  it('confirms the code regeneration and announces the new code', async () => {
    const { props } = renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /regenerar código k7m2qx/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName('Regenerar código de acesso?')

    fireEvent.click(screen.getByRole('button', { name: 'Regenerar código' }))

    await waitFor(() => expect(props.onRegenerateCode).toHaveBeenCalledWith(activeRoom))
    expect(
      await screen.findByText(/novo código de acesso: n4w7xz\. o código anterior não funciona mais\./i),
    ).toBeInTheDocument()
  })

  it('keeps the confirmation open when the API rejects it', async () => {
    const onCloseRoom = vi.fn(async () => {
      throw new Error('boom')
    })
    renderPage({ onCloseRoom })

    fireEvent.click(await screen.findByRole('button', { name: /encerrar sala k7m2qx/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sala' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível encerrar a sala/i)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})