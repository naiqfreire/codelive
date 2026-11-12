import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the active label', () => {
    render(<StatusBadge status="active" />)

    expect(screen.getByText('Aberta')).toBeInTheDocument()
  })

  it('renders the closed label', () => {
    render(<StatusBadge status="closed" />)

    expect(screen.getByText('Encerrada')).toBeInTheDocument()
  })

  it('marks the live dot as decorative', () => {
    const { container } = render(<StatusBadge status="active" />)

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('does not render the live dot when closed', () => {
    const { container } = render(<StatusBadge status="closed" />)

    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })
})
