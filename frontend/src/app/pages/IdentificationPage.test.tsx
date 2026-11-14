import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { RoomLookup } from '../../features/rooms'
import IdentificationPage from './IdentificationPage'

const room: RoomLookup = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'java',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
  ownerId: '22222222-2222-2222-2222-222222222222',
  updatedAt: '2026-11-10T10:00:00Z',
}

function renderPage(overrides: {
  choice?: { nickname: string; anonymous: boolean } | null
  onJoin?: (choice: { nickname: string; anonymous: boolean }) => void
  onClose?: () => void
} = {}) {
  const onJoin = vi.fn()
  const onClose = vi.fn()

  render(
    <MemoryRouter>
      <IdentificationPage
        room={room}
        choice={overrides.choice ?? null}
        onJoin={overrides.onJoin ?? onJoin}
        onClose={overrides.onClose ?? onClose}
      />
    </MemoryRouter>,
  )

  return { onJoin: overrides.onJoin ?? onJoin, onClose: overrides.onClose ?? onClose }
}

describe('IdentificationPage', () => {
  it('renders the step and opens the join modal with the room code', () => {
    renderPage()

    expect(screen.getByText('Passo 3 de 4')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Identificação' })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/sala k7m2qx/i)).toBeInTheDocument()
    expect(screen.getByText(/·\s*Java/)).toBeInTheDocument()
  })

  it('reports an authenticated choice', () => {
    const { onJoin } = renderPage()

    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }))

    expect(onJoin).toHaveBeenCalledWith({ nickname: 'Ana', anonymous: false })
  })

  it('reports an anonymous choice', () => {
    const { onJoin } = renderPage()

    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar sem conta' }))

    expect(onJoin).toHaveBeenCalledWith({ nickname: 'Ana', anonymous: true })
  })

  it('closes the modal through the close button', () => {
    const { onClose } = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the recorded choice instead of the modal', () => {
    renderPage({ choice: { nickname: 'Ana', anonymous: true } })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/ana/i)
    expect(screen.getByRole('status')).toHaveTextContent(/sem conta/i)
  })
})
