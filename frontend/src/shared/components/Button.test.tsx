import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders the destructive variant with the destructive token', () => {
    render(<Button variant="danger">Encerrar</Button>)

    const button = screen.getByRole('button', { name: 'Encerrar' })
    expect(button).toHaveClass('bg-destructive')
    expect(button).toHaveClass('text-accent-foreground')
  })

  it('blocks interaction while loading', () => {
    const onClick = vi.fn()
    render(
      <Button isLoading onClick={onClick}>
        Encerrando…
      </Button>,
    )

    const button = screen.getByRole('button', { name: /encerrando/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
