import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { RoomDetail } from '../../features/rooms'
import OwnerRoomPage from './OwnerRoomPage'

const room: RoomDetail = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
  code: "print('oi')",
}

type PageProps = {
  room?: RoomDetail
  onClose?: () => void
  onRegenerateCode?: () => void
  onLanguageChange?: (language: RoomDetail['language']) => void
}

function renderRoom(props: PageProps = {}) {
  return render(
    <MemoryRouter>
      <OwnerRoomPage room={room} {...props} />
    </MemoryRouter>,
  )
}

describe('OwnerRoomPage', () => {
  it('shows the access code with the copy action', () => {
    renderRoom()

    expect(screen.getByText('K7M2QX')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument()
  })

  it('shows the current language in the selector', () => {
    renderRoom()

    expect(screen.getByLabelText(/linguagem/i)).toHaveValue('python')
  })

  it('shows the active badge', () => {
    renderRoom()

    expect(screen.getByText('Aberta')).toBeInTheDocument()
  })

  it('renders an editable editor for the owner', () => {
    renderRoom()

    const editor = screen.getByRole('textbox', { name: /editor de código/i })
    expect(editor).toHaveAttribute('contenteditable', 'true')
    expect(editor).toHaveTextContent("print('oi')")
  })

  it('calls onClose from the close action', () => {
    const onClose = vi.fn()
    renderRoom({ onClose })

    fireEvent.click(screen.getAllByRole('button', { name: /encerrar sala/i })[0])

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onRegenerateCode from the regenerate action', () => {
    const onRegenerateCode = vi.fn()
    renderRoom({ onRegenerateCode })

    fireEvent.click(screen.getAllByRole('button', { name: /regenerar código/i })[0])

    expect(onRegenerateCode).toHaveBeenCalledTimes(1)
  })

  it('calls onLanguageChange when the language changes', () => {
    const onLanguageChange = vi.fn()
    renderRoom({ onLanguageChange })

    fireEvent.change(screen.getByLabelText(/linguagem/i), { target: { value: 'java' } })

    expect(onLanguageChange).toHaveBeenCalledWith('java')
  })

  it('links back to the room list', () => {
    renderRoom()

    expect(screen.getByRole('link', { name: /voltar/i })).toHaveAttribute('href', '/rooms')
  })

  it('shows a not-found state without a room', () => {
    render(
      <MemoryRouter>
        <OwnerRoomPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/sala não encontrada/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /voltar/i })).toHaveAttribute('href', '/rooms')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

describe('OwnerRoomPage (closed room)', () => {
  const closedRoom: RoomDetail = { ...room, status: 'closed' }

  it('shows the closed badge', () => {
    renderRoom({ room: closedRoom })

    expect(screen.getByText('Encerrada')).toBeInTheDocument()
  })

  it('explains the closed state in text', () => {
    renderRoom({ room: closedRoom })

    expect(screen.getByText(/esta sala foi encerrada/i)).toBeInTheDocument()
  })

  it('disables the close action', () => {
    renderRoom({ room: closedRoom })

    expect(screen.getAllByRole('button', { name: /encerrar sala/i })[0]).toBeDisabled()
  })

  it('disables the regenerate action', () => {
    renderRoom({ room: closedRoom })

    expect(screen.getAllByRole('button', { name: /regenerar código/i })[0]).toBeDisabled()
  })

  it('renders the editor as read-only', () => {
    renderRoom({ room: closedRoom })

    const editor = screen.getByRole('textbox', { name: /editor de código/i })
    expect(editor).toHaveAttribute('contenteditable', 'false')
    expect(editor).toHaveAttribute('aria-readonly', 'true')
  })

  it('keeps the code visible and copyable', () => {
    renderRoom({ room: closedRoom })

    expect(screen.getByText('K7M2QX')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copiar/i })).toBeEnabled()
  })
})
