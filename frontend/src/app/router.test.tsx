import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from './router'

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('router', () => {
  it('redirects the root path to the login page', async () => {
    renderRoute('/')

    expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument()
  })

  it('renders the register page', async () => {
    renderRoute('/register')

    expect(await screen.findByRole('heading', { name: /criar conta/i })).toBeInTheDocument()
  })
})
