import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateRoomDialog } from './CreateRoomDialog'

function renderDialog(overrides: Partial<Parameters<typeof CreateRoomDialog>[0]> = {}) {
  const props = {
    open: true,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }

  return { ...render(<CreateRoomDialog {...props} />), props }
}

describe('CreateRoomDialog', () => {
  it('renders nothing while closed', () => {
    renderDialog({ open: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('starts with Python and submits the chosen language', () => {
    const { props } = renderDialog()

    const language = screen.getByLabelText(/linguagem/i)
    expect(language).toHaveValue('python')

    fireEvent.change(language, { target: { value: 'java' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    expect(props.onSubmit).toHaveBeenCalledWith('java')
  })

  it('has an accessible title and description', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Nova sala')
    expect(dialog).toHaveAccessibleDescription(/escolha a linguagem/i)
  })

  it('cancels the creation', () => {
    const { props } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows the loading state and blocks dismissal', () => {
    const onCancel = vi.fn()
    renderDialog({ isLoading: true, onCancel })

    const submit = screen.getByRole('button', { name: /criando/i })
    expect(submit).toBeDisabled()
    expect(submit).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByLabelText(/linguagem/i)).toBeDisabled()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('shows an API error inside the dialog', () => {
    renderDialog({ error: 'Não foi possível criar a sala. Tente novamente.' })

    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível criar a sala/i)
  })
})