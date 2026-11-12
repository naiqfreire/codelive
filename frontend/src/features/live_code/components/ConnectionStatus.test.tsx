import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConnectionStatus } from './ConnectionStatus'

describe('ConnectionStatus', () => {
  it.each<['connecting' | 'connected' | 'reconnecting' | 'disconnected', string]>([
    ['connecting', 'Conectando…'],
    ['connected', 'Conectado'],
    ['reconnecting', 'Reconectando…'],
    ['disconnected', 'Sem conexão'],
  ])('announces the %s state', (status, label) => {
    render(<ConnectionStatus status={status} />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status')).toHaveTextContent(label)
  })

  it('hides the decorative indicator from assistive technology', () => {
    const { container } = render(<ConnectionStatus status="connected" />)

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
