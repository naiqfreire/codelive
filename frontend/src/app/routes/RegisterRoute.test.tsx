import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AuthApi } from '../../features/auth'
import { AuthProvider } from '../../features/auth'
import { ApiError } from '../../shared/http'
import { TEST_USER, createFakeAuthApi } from '../../test/auth'
import RegisterRoute from './RegisterRoute'

type Entry = string | { pathname: string; state?: unknown }

function renderRegisterRoute(api: AuthApi, entry: Entry = '/register') {
  const router = createMemoryRouter(
    [
      { path: '/register', element: <RegisterRoute /> },
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

function submitRegistration() {
  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: '  Ana Souza  ' } })
  fireEvent.change(screen.getByLabelText(/e-mail/i), {
    target: { value: ' ana@example.com ' },
  })
  fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo123' } })
  fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))
}

describe('RegisterRoute', () => {
  it('registers through the auth context and opens the room list', async () => {
    const register = vi.fn(async () => TEST_USER)
    renderRegisterRoute(createFakeAuthApi({ register }))

    submitRegistration()

    expect(await screen.findByText('minhas salas')).toBeInTheDocument()
    expect(register).toHaveBeenCalledWith({
      name: 'Ana Souza',
      email: 'ana@example.com',
      password: 'segredo123',
    })
  })

  it('returns to the path that required authentication', async () => {
    renderRegisterRoute(createFakeAuthApi(), {
      pathname: '/register',
      state: { from: '/rooms/abc' },
    })

    submitRegistration()

    expect(await screen.findByText('sala selecionada')).toBeInTheDocument()
  })

  it('stays on the registration page and shows the API error', async () => {
    const register = vi.fn(async () => {
      throw new ApiError(409, 'email_already_exists', 'E-mail já cadastrado.', 'req-1')
    })
    renderRegisterRoute(createFakeAuthApi({ register }))

    submitRegistration()

    expect(await screen.findByText('Este e-mail já está cadastrado.')).toBeInTheDocument()
    expect(screen.queryByText('minhas salas')).not.toBeInTheDocument()
  })
})
