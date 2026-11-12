import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './AppShell'

function renderShell() {
  const router = createMemoryRouter(
    [
      {
        path: '/rooms',
        element: <AppShell />,
        children: [{ index: true, element: <p>Conteúdo roteado</p> }],
      },
    ],
    { initialEntries: ['/rooms'] },
  )

  return render(<RouterProvider router={router} />)
}

describe('AppShell', () => {
  it('renders the brand and the routed content', async () => {
    renderShell()

    expect(await screen.findByText('CodeLive')).toBeInTheDocument()
    expect(screen.getByText('Conteúdo roteado')).toBeInTheDocument()
  })

  it('marks the current section with aria-current page', async () => {
    renderShell()

    expect(await screen.findByRole('link', { name: /minhas salas/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders the future navigation items as disabled', async () => {
    renderShell()

    const enterWithCode = await screen.findByText(/entrar com código/i)
    const signOut = screen.getByText(/^sair$/i)

    expect(enterWithCode).toHaveAttribute('aria-disabled', 'true')
    expect(signOut).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('link', { name: /entrar com código/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^sair$/i })).not.toBeInTheDocument()
  })
})
