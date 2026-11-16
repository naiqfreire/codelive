import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { JoinedRoom } from '../../features/rooms'
import JoinedRoomsPage from './JoinedRoomsPage'

const activeRoom: JoinedRoom = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
  joinedAt: '2026-11-11T10:00:00Z',
}

const closedRoom: JoinedRoom = {
  id: '22222222-2222-2222-2222-222222222222',
  accessCode: 'B4T9RS',
  language: 'java',
  status: 'closed',
  createdAt: '2026-11-08T17:30:00Z',
  joinedAt: '2026-11-10T10:00:00Z',
}

type PageProps = {
  rooms?: JoinedRoom[]
  isLoading?: boolean
  errorMessage?: string | null
  isSessionExpired?: boolean
  onRetry?: () => void
}

function renderPage(overrides: PageProps = {}) {
  const props = {
    rooms: [activeRoom, closedRoom],
    isLoading: false,
    errorMessage: null,
    isSessionExpired: false,
    onRetry: vi.fn(),
    ...overrides,
  }

  const router = createMemoryRouter(
    [
      { path: '/rooms/joined', element: <JoinedRoomsPage {...props} /> },
      { path: '/rooms/join', element: <p>tela do código</p> },
    ],
    { initialEntries: ['/rooms/joined'] },
  )

  return { ...render(<RouterProvider router={router} />), props }
}

describe('JoinedRoomsPage', () => {
  it('renders one card per joined room', async () => {
    renderPage()

    expect(await screen.findAllByRole('heading', { level: 2 })).toHaveLength(2)
  })

  it('titles the page "Salas que participei" and offers the room filters', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Salas que participei' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Filtro de salas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Participei' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('summarizes the open and closed counts', async () => {
    renderPage()

    expect(await screen.findByText(/1 aberta/)).toBeInTheDocument()
    expect(screen.getByText(/1 encerrada/)).toBeInTheDocument()
  })

  it('shows the empty state pointing at the access-code step', async () => {
    renderPage({ rooms: [] })

    expect(await screen.findByText(/você ainda não entrou em nenhuma sala/i)).toBeInTheDocument()
    const enterLinks = screen.getAllByRole('link', { name: /entrar com código/i })
    expect(enterLinks.length).toBeGreaterThan(0)
    for (const link of enterLinks) {
      expect(link).toHaveAttribute('href', '/rooms/join')
    }
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
})
