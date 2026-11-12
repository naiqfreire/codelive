import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AuthApi } from '../../features/auth'
import { AuthProvider } from '../../features/auth'
import { ApiError } from '../../shared/http'
import { TEST_USER, createFakeAuthApi } from '../../test/auth'
import LoginRoute from './LoginRoute'

type Entry = string | { pathname: string; state?: unknown }

function renderLoginRoute(api: AuthApi, entry: Entry = '/login') {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginRoute /> },
      { path: '/rooms', element: <p>minhas salas</p> },
      { path: '/rooms/:roomId', element: <p>sala selecionada</p> },
    ],
    { initialEntries: [entry] },
  )

  return render(
    <AuthProvider api={api}>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

function submitCredentials() {
  fireEvent.change(screen.getByLabelText(/e-mail/i), {
    target: { value: '  ana@example.com  ' },
  })
  fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo123' } })
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }))
}

describe('LoginRoute', () => {
  it('logs in through the auth context and opens the room list', async () => {
    const login = vi.fn(async () => TEST_USER)
    renderLoginRoute(createFakeAuthApi({ login }))

    submitCredentials()

    expect(await screen.findByText('minhas salas')).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'segredo123',
    })
  })

  it('returns to the path that required authentication', async () => {
    renderLoginRoute(createFakeAuthApi(), {
      pathname: '/login',
      state: { from: '/rooms/abc' },
    })

    submitCredentials()

    expect(await screen.findByText('sala selecionada')).toBeInTheDocument()
  })

  it('ignores an external redirect target', async () => {
    renderLoginRoute(createFakeAuthApi(), {
      pathname: '/login',
      state: { from: '//evil.example/login' },
    })

    submitCredentials()

    expect(await screen.findByText('minhas salas')).toBeInTheDocument()
  })

  it('stays on the login page and shows the API error', async () => {
    const login = vi.fn(async () => {
      throw new ApiError(401, 'invalid_credentials', 'Credenciais inválidas.', 'req-1')
    })
    renderLoginRoute(createFakeAuthApi({ login }))

    submitCredentials()

    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument()
    expect(screen.queryByText('minhas salas')).not.toBeInTheDocument()
  })
})
