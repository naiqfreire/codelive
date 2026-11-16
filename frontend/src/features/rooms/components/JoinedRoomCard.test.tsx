import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JoinedRoom } from '../types'
import { JoinedRoomCard } from './JoinedRoomCard'

const activeRoom: JoinedRoom = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
  joinedAt: '2026-11-11T10:00:00Z',
}

function renderCard(room: JoinedRoom = activeRoom) {
  return render(
    <MemoryRouter>
      <JoinedRoomCard room={room} />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('JoinedRoomCard', () => {
  it('shows the access code as the title', () => {
    renderCard()

    expect(screen.getByRole('heading', { name: 'K7M2QX' })).toBeInTheDocument()
  })

  it('shows the open status and the language', () => {
    renderCard()

    expect(screen.getByText('Aberta')).toBeInTheDocument()
    expect(screen.getByText(/python/i)).toBeInTheDocument()
  })

  it('shows when the user joined the room', () => {
    renderCard()

    expect(screen.getByText(/entrou em 11\/11\/2026/)).toBeInTheDocument()
  })

  it('links to the spectator view of an open room', () => {
    renderCard()

    expect(screen.getByRole('link', { name: /assistir sala k7m2qx/i })).toHaveAttribute(
      'href',
      `/rooms/${activeRoom.id}/view`,
    )
  })

  it('does not offer quick access to a closed room', () => {
    renderCard({ ...activeRoom, status: 'closed' })

    expect(screen.getByText('Encerrada')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /assistir sala/i })).not.toBeInTheDocument()
    expect(screen.getByText(/sala encerrada: não é possível assistir/i)).toBeInTheDocument()
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
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
    })

    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /copiar código k7m2qx/i }))

    expect(
      await screen.findByText(/selecione o código e copie manualmente/i),
    ).toBeInTheDocument()
  })
})
