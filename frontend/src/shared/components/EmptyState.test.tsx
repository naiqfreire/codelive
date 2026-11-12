import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the title and the description', () => {
    render(<EmptyState title="Nada por aqui" description="Crie a primeira sala." />)

    expect(screen.getByText('Nada por aqui')).toBeInTheDocument()
    expect(screen.getByText('Crie a primeira sala.')).toBeInTheDocument()
  })

  it('renders the action when provided', () => {
    render(<EmptyState title="Nada por aqui" action={<button type="button">Criar</button>} />)

    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument()
  })

  it('hides the icon from assistive technology', () => {
    const { container } = render(
      <EmptyState title="Nada por aqui" icon={<svg data-testid="empty-icon" />} />,
    )

    const wrapper = container.querySelector('[aria-hidden="true"]')

    expect(wrapper).not.toBeNull()
    expect(wrapper?.querySelector('[data-testid="empty-icon"]')).not.toBeNull()
  })
})
