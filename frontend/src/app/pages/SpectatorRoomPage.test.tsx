import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { RoomConnectionState } from '../../features/live_code'
import type { RoomDetail } from '../../features/rooms'
import SpectatorRoomPage from './SpectatorRoomPage'

const room: RoomDetail = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
  code: "print('oi')",
}

const connected: RoomConnectionState = {
  status: 'connected',
  code: "print('oi')",
  language: 'python',
  participantCount: 2,
  role: 'viewer',
  lastError: null,
}

type PageOverrides = {
  room?: RoomDetail
  connection?: RoomConnectionState
}

function renderPage(overrides: PageOverrides = {}) {
  return render(
    <MemoryRouter>
      <SpectatorRoomPage room={room} connection={connected} {...overrides} />
    </MemoryRouter>,
  )
}

describe('SpectatorRoomPage', () => {
  it('renders a read-only editor', () => {
    renderPage()

    const editor = screen.getByRole('textbox', { name: /código da sala/i })
    expect(editor).toHaveAttribute('contenteditable', 'false')
    expect(editor).toHaveAttribute('aria-readonly', 'true')
    expect(editor).toHaveTextContent("print('oi')")
  })

  it('explains that only the owner can edit', () => {
    renderPage()

    expect(screen.getByText(/somente o dono da sala pode editar/i)).toBeInTheDocument()
  })

  it('shows the live connection status', () => {
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Conectado')
  })

  it('shows the participant count', () => {
    renderPage()

    expect(screen.getByText('2 participantes conectados')).toBeInTheDocument()
  })

  it('uses the singular for one participant', () => {
    renderPage({ connection: { ...connected, participantCount: 1 } })

    expect(screen.getByText('1 participante conectado')).toBeInTheDocument()
  })

  it('updates the code when a new snapshot arrives', () => {
    const { rerender } = renderPage()

    rerender(
      <MemoryRouter>
        <SpectatorRoomPage room={room} connection={{ ...connected, code: 'novo código' }} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('textbox')).toHaveTextContent('novo código')
  })

  it('keeps the code visible while reconnecting', () => {
    renderPage({ connection: { ...connected, status: 'reconnecting' } })

    expect(screen.getByRole('status')).toHaveTextContent('Reconectando…')
    expect(screen.getByRole('textbox')).toHaveTextContent("print('oi')")
  })

  it('shows the connection error and keeps the code', () => {
    renderPage({
      connection: {
        ...connected,
        lastError: {
          code: 'validation_error',
          message: 'Dados inválidos.',
          requestId: 'req-1',
        },
      },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Dados inválidos.')
    expect(screen.getByRole('textbox')).toHaveTextContent("print('oi')")
  })

  it('shows the closed badge for a closed room', () => {
    renderPage({ room: { ...room, status: 'closed' } })

    expect(screen.getByText('Encerrada')).toBeInTheDocument()
  })

  it('shows the not-found state without a room', () => {
    render(
      <MemoryRouter>
        <SpectatorRoomPage connection={connected} />
      </MemoryRouter>,
    )

    expect(screen.getByText(/sala não encontrada/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
