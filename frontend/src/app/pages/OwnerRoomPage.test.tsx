import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { RoomConnection } from '../../features/live_code'
import {
  CODE_LOADING_MESSAGE,
  CONFLICT_ACCEPT_LABEL,
  CONFLICT_KEEP_LABEL,
  LATEST_VERSION_MESSAGE,
  OVERSIZE_MESSAGE,
} from '../../features/live_code'
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

function makeConnection(overrides: Partial<RoomConnection> = {}): RoomConnection {
  return {
    status: 'connected',
    code: "print('oi')",
    language: 'python',
    participantCount: 1,
    role: 'owner',
    lastError: null,
    hasSnapshot: true,
    isOversize: false,
    conflict: null,
    syncNotice: null,
    updateCode: vi.fn(),
    applyRestoredCode: vi.fn(),
    acceptServerVersion: vi.fn(),
    keepLocalVersion: vi.fn(),
    ...overrides,
  }
}

type PageProps = {
  room?: RoomDetail
  connection?: RoomConnection
  onClose?: () => void
  onRegenerateCode?: () => void
  onLanguageChange?: (language: RoomDetail['language']) => void
  renderVersionHistory?: (onRestored: (content: string) => void) => ReactElement
}

function renderRoom({ connection = makeConnection(), ...props }: PageProps = {}) {
  return render(
    <MemoryRouter>
      <OwnerRoomPage room={room} connection={connection} {...props} />
    </MemoryRouter>,
  )
}

describe('OwnerRoomPage', () => {
  it('shows the access code with the copy action', () => {
    renderRoom()

    expect(screen.getByText('K7M2QX')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument()
  })

  it('keeps the title and the access code in the same header', () => {
    renderRoom()

    expect(screen.getByRole('heading', { level: 1, name: 'Sua sala' })).toBeInTheDocument()
    expect(screen.getByText('K7M2QX')).toBeInTheDocument()
  })

  it('shows the current language in the selector', () => {
    renderRoom()

    expect(screen.getByLabelText(/linguagem/i)).toHaveValue('python')
  })

  it('shows the active badge', () => {
    renderRoom()

    expect(screen.getByText('Aberta')).toBeInTheDocument()
  })

  it('does not mark the active room as read-only', () => {
    renderRoom()

    expect(screen.queryByText('Somente leitura')).not.toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: /encerrar sala/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onRegenerateCode from the regenerate action', () => {
    const onRegenerateCode = vi.fn()
    renderRoom({ onRegenerateCode })

    fireEvent.click(screen.getByRole('button', { name: /regenerar código/i }))

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

  it('renders the version history slot below the editor', () => {
    renderRoom({ renderVersionHistory: () => <p>Histórico de teste</p> })

    expect(screen.getByText('Histórico de teste')).toBeInTheDocument()
  })

  it('forwards the restored content without echoing it locally', () => {
    const applyRestoredCode = vi.fn()
    const connection = makeConnection({ applyRestoredCode })

    renderRoom({
      connection,
      renderVersionHistory: (onRestored) => (
        <button type="button" onClick={() => onRestored("print('restaurado')\n")}>
          Restaurar de teste
        </button>
      ),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar de teste' }))

    expect(applyRestoredCode).toHaveBeenCalledWith("print('restaurado')\n")
  })

  it('shows a not-found state without a room', () => {
    render(
      <MemoryRouter>
        <OwnerRoomPage
          connection={makeConnection()}
          renderVersionHistory={() => <p>Histórico de teste</p>}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText(/sala não encontrada/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /voltar/i })).toHaveAttribute('href', '/rooms')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Histórico de teste')).not.toBeInTheDocument()
  })
})

describe('OwnerRoomPage code recovery', () => {
  it('locks the editor and explains the wait before the first snapshot', () => {
    renderRoom({ connection: makeConnection({ code: '', hasSnapshot: false }) })

    expect(screen.getByText(CODE_LOADING_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /editor de código/i })).toHaveAttribute(
      'contenteditable',
      'false',
    )
  })

  it('shows the recovered code and unlocks the editor after the snapshot', () => {
    renderRoom({ connection: makeConnection({ code: 'recuperado', hasSnapshot: true }) })

    const editor = screen.getByRole('textbox', { name: /editor de código/i })
    expect(editor).toHaveAttribute('contenteditable', 'true')
    expect(editor).toHaveTextContent('recuperado')
    expect(screen.queryByText(CODE_LOADING_MESSAGE)).not.toBeInTheDocument()
  })

  it('keeps the editor editable while reconnecting after the snapshot', () => {
    renderRoom({ connection: makeConnection({ hasSnapshot: true, status: 'reconnecting' }) })

    expect(screen.getByRole('status')).toHaveTextContent('Reconectando…')
    expect(screen.getByRole('textbox', { name: /editor de código/i })).toHaveAttribute(
      'contenteditable',
      'true',
    )
  })

  it('shows the latest version notice after an accepted snapshot', () => {
    renderRoom({ connection: makeConnection({ syncNotice: LATEST_VERSION_MESSAGE }) })

    expect(screen.getByText(LATEST_VERSION_MESSAGE)).toBeInTheDocument()
  })

  it('shows the conflict and forwards the chosen action', () => {
    const acceptServerVersion = vi.fn()
    const keepLocalVersion = vi.fn()

    renderRoom({
      connection: makeConnection({
        conflict: {
          serverContent: 'servidor',
          receivedAt: '2026-11-16T14:32:05.000Z',
        },
        acceptServerVersion,
        keepLocalVersion,
      }),
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/versão mais recente/i)

    fireEvent.click(screen.getByRole('button', { name: CONFLICT_ACCEPT_LABEL }))
    fireEvent.click(screen.getByRole('button', { name: CONFLICT_KEEP_LABEL }))

    expect(acceptServerVersion).toHaveBeenCalledTimes(1)
    expect(keepLocalVersion).toHaveBeenCalledTimes(1)
  })

  it('keeps the editor editable while the conflict is open', () => {
    renderRoom({
      connection: makeConnection({
        conflict: { serverContent: 'servidor', receivedAt: '2026-11-16T14:32:05.000Z' },
      }),
    })

    expect(screen.getByRole('textbox')).toHaveAttribute('contenteditable', 'true')
  })

  it('warns when the local content exceeds the size limit', () => {
    renderRoom({ connection: makeConnection({ isOversize: true }) })

    expect(screen.getByText(OVERSIZE_MESSAGE)).toBeInTheDocument()
  })
})

describe('OwnerRoomPage (closed room)', () => {
  const closedRoom: RoomDetail = { ...room, status: 'closed' }

  it('shows the closed badge', () => {
    renderRoom({ room: closedRoom })

    expect(screen.getByText('Encerrada')).toBeInTheDocument()
  })

  it('marks the closed room as read-only', () => {
    renderRoom({ room: closedRoom })

    expect(screen.getByText('Somente leitura')).toBeInTheDocument()
  })

  it('explains the closed state in text', () => {
    renderRoom({ room: closedRoom })

    expect(screen.getByText(/esta sala foi encerrada/i)).toBeInTheDocument()
  })

  it('disables the close action', () => {
    renderRoom({ room: closedRoom })

    expect(screen.getByRole('button', { name: /encerrar sala/i })).toBeDisabled()
  })

  it('disables the regenerate action', () => {
    renderRoom({ room: closedRoom })

    expect(screen.getByRole('button', { name: /regenerar código/i })).toBeDisabled()
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
