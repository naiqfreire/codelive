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
  anonymousEntry?: boolean
  isSubmitting?: boolean
  errorMessage?: string | null
  onJoin?: (choice: { nickname: string; anonymous: boolean }) => void
  onClose?: () => void
} = {}) {
  const onJoin = vi.fn()
  const onClose = vi.fn()

  render(
    <MemoryRouter>
      <IdentificationPage
        room={room}
        anonymousEntry={overrides.anonymousEntry ?? false}
        isSubmitting={overrides.isSubmitting}
        errorMessage={overrides.errorMessage}
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
    expect(screen.getByText(/entrar com sua conta/i)).toBeInTheDocument()
  })

  it('reports an authenticated choice', () => {
    const { onJoin } = renderPage()

    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }))

    expect(onJoin).toHaveBeenCalledWith({ nickname: 'Ana', anonymous: false })
  })

  it('reports an anonymous choice', () => {
    const { onJoin } = renderPage({ anonymousEntry: true })

    expect(screen.getByRole('button', { name: 'Entrar sem conta' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar sem conta' }))

    expect(onJoin).toHaveBeenCalledWith({ nickname: 'Ana', anonymous: true })
  })

  it('shows the submitting state inside the modal', () => {
    renderPage({ isSubmitting: true })

    expect(screen.getByRole('button', { name: /entrando/i })).toBeDisabled()
  })

  it('shows a server error inside the modal', () => {
    renderPage({ errorMessage: 'Não foi possível entrar na sala. Tente novamente.' })

    expect(screen.getByText(/não foi possível entrar na sala/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes the modal through the close button', () => {
    const { onClose } = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
