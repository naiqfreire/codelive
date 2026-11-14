import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { RoomLookup } from '../../features/rooms'
import JoinRoomRoute from './JoinRoomRoute'

const room: RoomLookup = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'java',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
  ownerId: '22222222-2222-2222-2222-222222222222',
  updatedAt: '2026-11-10T10:00:00Z',
}

function CodeEntryStub() {
  const location = useLocation()
  const code = (location.state as { code?: string } | null)?.code ?? 'sem código'
  return <p>tela do código: {code}</p>
}

function renderRoute(state?: unknown, roomId = room.id) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/rooms/${roomId}/join`, state }]}>
      <Routes>
        <Route path="/rooms/join" element={<CodeEntryStub />} />
        <Route path="/rooms/:roomId/join" element={<JoinRoomRoute />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JoinRoomRoute', () => {
  it('renders the identification step when the navigation state carries the room', () => {
    renderRoute({ room })

    expect(screen.getByText('Passo 3 de 4')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Identificação' })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('records the choice without leaving the screen', () => {
    renderRoute({ room })

    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/ana/i)
  })

  it('closes the modal and returns to the code step with the code preserved', () => {
    renderRoute({ room })

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(screen.getByText('tela do código: K7M2QX')).toBeInTheDocument()
  })

  it('asks for the code when the navigation state is missing', () => {
    renderRoute()

    expect(screen.getByRole('heading', { name: /código necessário/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks for the code when the state belongs to another room', () => {
    renderRoute({ room }, '33333333-3333-3333-3333-333333333333')

    expect(screen.getByRole('heading', { name: /código necessário/i })).toBeInTheDocument()
  })

  it('blocks a closed room resolved by the previous step', () => {
    renderRoute({ room: { ...room, status: 'closed' } })

    expect(screen.getByRole('heading', { name: /sala encerrada/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
