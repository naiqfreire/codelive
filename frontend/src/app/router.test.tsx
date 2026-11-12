import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SAMPLE_ROOMS } from './dev/sampleRooms'
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

  it('renders the room list inside the shell', async () => {
    renderRoute('/rooms')

    expect(await screen.findByRole('heading', { name: /suas salas/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /minhas salas/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders an owner room from the fixture', async () => {
    renderRoute(`/rooms/${SAMPLE_ROOMS[0].id}`)

    expect(await screen.findByRole('heading', { name: /sua sala/i })).toBeInTheDocument()
  })

  it('shows the not-found state for an unknown room', async () => {
    renderRoute('/rooms/00000000-0000-0000-0000-000000000000')

    expect(await screen.findByText(/sala não encontrada/i)).toBeInTheDocument()
  })

  it('does not render the shell navigation on the login page', async () => {
    renderRoute('/login')

    expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /minhas salas/i })).not.toBeInTheDocument()
  })
})
