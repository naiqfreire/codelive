import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { JoinRoomModal } from './JoinRoomModal'

type Props = {
  accessCode?: string
  isSubmitting?: boolean
  anonymousEntry?: boolean
  error?: string | null
  onJoin?: (choice: { nickname: string; anonymous: boolean }) => void
  onClose?: () => void
}

function renderModal({
  accessCode,
  isSubmitting,
  anonymousEntry,
  error,
  onJoin,
  onClose,
}: Props = {}) {
  return render(
    <JoinRoomModal
      accessCode={accessCode}
      isSubmitting={isSubmitting}
      anonymousEntry={anonymousEntry}
      error={error}
      onJoin={onJoin ?? (() => {})}
      onClose={onClose ?? (() => {})}
    />,
  )
}

describe('JoinRoomModal', () => {
  it('shows the nickname field and the account action by default', () => {
    renderModal()

    expect(screen.getByRole('dialog', { name: /entrar na sala/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument()
    expect(screen.getByText(/até 60 caracteres/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^entrar na sala$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /entrar sem conta/i })).not.toBeInTheDocument()
  })

  it('shows the anonymous action when the visitor has no account', () => {
    renderModal({ anonymousEntry: true })

    expect(screen.getByRole('button', { name: /^entrar sem conta$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^entrar na sala$/i })).not.toBeInTheDocument()
  })

  it('shows the room code when it is provided', () => {
    renderModal({ accessCode: 'K7M2QX' })

    expect(screen.getByText(/K7M2QX/)).toBeInTheDocument()
  })

  it('focuses the nickname field when it opens', () => {
    renderModal()

    expect(screen.getByLabelText(/nickname/i)).toHaveFocus()
  })

  it('blocks the entry when the nickname is empty', () => {
    const onJoin = vi.fn()
    renderModal({ onJoin })

    fireEvent.click(screen.getByRole('button', { name: /^entrar na sala$/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/informe um nickname/i)
    expect(onJoin).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('blocks the entry when the nickname is too long', () => {
    const onJoin = vi.fn()
    renderModal({ onJoin })

    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'a'.repeat(61) } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar na sala$/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/60/)
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('sends the trimmed nickname with the account identity', () => {
    const onJoin = vi.fn()
    renderModal({ onJoin })

    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: '  Ana  ' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar na sala$/i }))

    expect(onJoin).toHaveBeenCalledWith({ nickname: 'Ana', anonymous: false })
  })

  it('sends the anonymous flag when the visitor has no account', () => {
    const onJoin = vi.fn()
    renderModal({ anonymousEntry: true, onJoin })

    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar sem conta$/i }))

    expect(onJoin).toHaveBeenCalledWith({ nickname: 'Ana', anonymous: true })
  })

  it('requires the nickname even for the anonymous entry', () => {
    const onJoin = vi.fn()
    renderModal({ anonymousEntry: true, onJoin })

    fireEvent.click(screen.getByRole('button', { name: /^entrar sem conta$/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/informe um nickname/i)
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('clears the field error while the user types', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: /^entrar na sala$/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'Ana' } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a server error without closing the modal', () => {
    renderModal({ error: 'Não foi possível entrar na sala. Tente novamente.' })

    expect(screen.getByText(/não foi possível entrar na sala/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes without joining from the close button', () => {
    const onClose = vi.fn()
    const onJoin = vi.fn()
    renderModal({ onClose, onJoin })

    fireEvent.click(screen.getByRole('button', { name: /fechar/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('disables the field and the action while submitting', () => {
    renderModal({ isSubmitting: true })

    expect(screen.getByLabelText(/nickname/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /entrando/i })).toBeDisabled()
  })
})
