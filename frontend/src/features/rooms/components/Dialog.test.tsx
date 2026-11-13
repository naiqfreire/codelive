import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

function Harness({
  dismissible = true,
  onClose = vi.fn(),
  showExtraAction = false,
}: {
  dismissible?: boolean
  onClose?: () => void
  showExtraAction?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Dialog
        open={open}
        labelledBy="dialog-title"
        describedBy="dialog-description"
        dismissible={dismissible}
        onClose={() => {
          onClose()
          setOpen(false)
        }}
      >
        <h2 id="dialog-title">Nova sala</h2>
        <p id="dialog-description">Escolha a linguagem.</p>
        <button type="button" data-dialog-cancel>
          Cancelar
        </button>
        {showExtraAction ? (
          <button type="button" data-dialog-confirm>
            Criar sala
          </button>
        ) : null}
      </Dialog>
    </div>
  )
}

async function openDialog() {
  const trigger = screen.getByRole('button', { name: 'Abrir' })
  trigger.focus()
  fireEvent.click(trigger)
  return screen.findByRole('dialog')
}

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    render(<Harness />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exposes an accessible name and description', async () => {
    render(<Harness />)

    const dialog = await openDialog()

    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Nova sala')
    expect(dialog).toHaveAccessibleDescription('Escolha a linguagem.')
  })

  it('moves the focus to the cancel action', async () => {
    render(<Harness />)
    await openDialog()

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('closes on Escape and returns the focus to the trigger', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await openDialog()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('ignores Escape while not dismissible', async () => {
    const onClose = vi.fn()
    render(<Harness dismissible={false} onClose={onClose} />)
    await openDialog()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on a backdrop press but not on a press inside the dialog', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const dialog = await openDialog()

    fireEvent.mouseDown(dialog)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores backdrop presses while not dismissible', async () => {
    const onClose = vi.fn()
    render(<Harness dismissible={false} onClose={onClose} />)
    await openDialog()

    fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps Tab inside the dialog', async () => {
    render(<Harness showExtraAction />)
    await openDialog()

    const cancel = screen.getByRole('button', { name: 'Cancelar' })
    const confirm = screen.getByRole('button', { name: 'Criar sala' })

    confirm.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(cancel).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(confirm).toHaveFocus()
  })
})