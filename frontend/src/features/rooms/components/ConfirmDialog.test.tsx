import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const props = {
    open: true,
    title: 'Encerrar sala K7M2QX?',
    description: 'A sala não poderá ser reaberta.',
    confirmLabel: 'Encerrar sala',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }

  return { ...render(<ConfirmDialog {...props} />), props }
}

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    renderDialog({ open: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the title, the description and both actions', () => {
    renderDialog()

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Encerrar sala K7M2QX?')
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'A sala não poderá ser reaberta.',
    )
    expect(screen.getByRole('button', { name: 'Encerrar sala' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('confirms and cancels', () => {
    const { props } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sala' }))
    expect(props.onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })

  it('uses the destructive style when asked', () => {
    renderDialog({ variant: 'danger' })

    expect(screen.getByRole('button', { name: 'Encerrar sala' })).toHaveClass('bg-destructive')
  })

  it('shows the loading state and blocks dismissal', () => {
    const onCancel = vi.fn()
    renderDialog({ isLoading: true, onCancel })

    const confirm = screen.getByRole('button', { name: /encerrando/i })
    expect(confirm).toBeDisabled()
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('shows an API error next to the actions', () => {
    renderDialog({ error: 'Esta sala já foi encerrada.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Esta sala já foi encerrada.')
  })
})