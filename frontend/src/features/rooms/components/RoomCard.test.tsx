import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSummary } from '../types'
import { RoomCard } from './RoomCard'

const activeRoom: RoomSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
}

type CardProps = {
  onClose?: (room: RoomSummary) => void
  onRegenerateCode?: (room: RoomSummary) => void
}

function renderCard(room: RoomSummary = activeRoom, href = '/rooms/1', props: CardProps = {}) {
  return render(
    <MemoryRouter>
      <RoomCard room={room} href={href} {...props} />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RoomCard', () => {
  it('shows the access code as the title', () => {
    renderCard()

    expect(screen.getByRole('heading', { name: 'K7M2QX' })).toBeInTheDocument()
  })

  it('shows the language label', () => {
    renderCard()

    expect(screen.getByText(/python/i)).toBeInTheDocument()
  })

  it('shows the formatted creation date', () => {
    renderCard()

    expect(screen.getByText(/09\/11\/2026/)).toBeInTheDocument()
  })

  it('shows the closed state', () => {
    renderCard({ ...activeRoom, status: 'closed' })

    expect(screen.getByText('Encerrada')).toBeInTheDocument()
  })

  it('links to the given href', () => {
    renderCard(activeRoom, '/rooms/abc')

    expect(screen.getByRole('link', { name: /abrir sala k7m2qx/i })).toHaveAttribute(
      'href',
      '/rooms/abc',
    )
  })

  it('gives the link an accessible name with the code', () => {
    renderCard()

    expect(screen.getByRole('link', { name: /abrir sala k7m2qx/i })).toBeInTheDocument()
  })

  it('copies the access code and announces success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /copiar código k7m2qx/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('K7M2QX'))
    expect(await screen.findByText('Copiado!')).toBeInTheDocument()
  })

  it('explains the manual fallback when the clipboard fails', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } })

    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /copiar código k7m2qx/i }))

    expect(
      await screen.findByText(/selecione o código e copie manualmente/i),
    ).toBeInTheDocument()
  })

  it('offers the management actions for an active room', () => {
    renderCard(activeRoom, '/rooms/1', { onClose: vi.fn(), onRegenerateCode: vi.fn() })

    expect(screen.getByRole('button', { name: /regenerar código k7m2qx/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /encerrar sala k7m2qx/i })).toBeInTheDocument()
  })

  it('hides the management actions for a closed room', () => {
    renderCard({ ...activeRoom, status: 'closed' }, '/rooms/1', {
      onClose: vi.fn(),
      onRegenerateCode: vi.fn(),
    })

    expect(
      screen.queryByRole('button', { name: /regenerar código k7m2qx/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /encerrar sala k7m2qx/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copiar código k7m2qx/i })).toBeInTheDocument()
  })

  it('calls the close handler with the room', () => {
    const onClose = vi.fn()
    renderCard(activeRoom, '/rooms/1', { onClose, onRegenerateCode: vi.fn() })

    fireEvent.click(screen.getByRole('button', { name: /encerrar sala k7m2qx/i }))

    expect(onClose).toHaveBeenCalledWith(activeRoom)
  })

  it('calls the regenerate handler with the room', () => {
    const onRegenerateCode = vi.fn()
    renderCard(activeRoom, '/rooms/1', { onClose: vi.fn(), onRegenerateCode })

    fireEvent.click(screen.getByRole('button', { name: /regenerar código k7m2qx/i }))

    expect(onRegenerateCode).toHaveBeenCalledWith(activeRoom)
  })
})