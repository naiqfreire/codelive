import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open ? (
        <Modal
          title="Entrar na sala"
          description="Escolha como você quer aparecer."
          onClose={() => {
            onClose()
            setOpen(false)
          }}
        >
          <input aria-label="Nickname" />
          <button type="button">Enviar</button>
        </Modal>
      ) : null}
    </>
  )
}

function openModal(onClose?: () => void) {
  render(<Harness onClose={onClose} />)

  // jsdom does not move the focus on click, so the trigger is focused explicitly.
  const trigger = screen.getByRole('button', { name: 'Abrir' })
  trigger.focus()
  fireEvent.click(trigger)
}

describe('Modal', () => {
  it('renders the title and the content as a labelled dialog', () => {
    openModal()

    const dialog = screen.getByRole('dialog', { name: 'Entrar na sala' })

    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-describedby')
    expect(screen.getByLabelText('Nickname')).toBeInTheDocument()
  })

  it('focuses the first field when it opens', () => {
    openModal()

    expect(screen.getByLabelText('Nickname')).toHaveFocus()
  })

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn()
    openModal(onClose)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', () => {
    openModal()

    fireEvent.click(screen.getByTestId('modal-overlay'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not close when the panel is clicked', () => {
    openModal()

    fireEvent.click(screen.getByRole('dialog'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes from the close button', () => {
    openModal()

    fireEvent.click(screen.getByRole('button', { name: /fechar/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('restores the focus to the trigger after closing', () => {
    openModal()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('keeps the tab cycle inside the dialog', () => {
    openModal()

    const dialog = screen.getByRole('dialog')
    const close = screen.getByRole('button', { name: /fechar/i })

    close.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByLabelText('Nickname')).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(close).toHaveFocus()
    expect(dialog).toBeInTheDocument()
  })

  it('locks the page scroll while it is open', () => {
    openModal()

    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(document.body.style.overflow).toBe('')
  })
})
