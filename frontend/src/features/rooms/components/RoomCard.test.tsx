import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { RoomSummary } from '../types'
import { RoomCard } from './RoomCard'

const activeRoom: RoomSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
}

function renderCard(room: RoomSummary = activeRoom, href = '/rooms/1') {
  return render(
    <MemoryRouter>
      <RoomCard room={room} href={href} />
    </MemoryRouter>,
  )
}

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

  it('does not render a copy action', () => {
    renderCard()

    expect(screen.queryByRole('button', { name: /copiar/i })).not.toBeInTheDocument()
  })
})
