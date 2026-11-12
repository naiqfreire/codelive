import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../shared/http'
import { TEST_USER, anonymousAuthError, createFakeAuthApi } from '../../test/auth'
import { AuthProvider } from './AuthProvider'
import type { AuthApi } from './api'
import { ProtectedRoute } from './ProtectedRoute'

function LocationProbe() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? 'sem origem'
  return <p>tela de login, origem {from}</p>
}

function renderProtected(api: AuthApi, initialEntry = '/rooms') {
  const router = createMemoryRouter(
    [
      {
        element: <ProtectedRoute />,
        children: [{ path: '/rooms', element: <p>conteúdo privado</p> }],
      },
      { path: '/login', element: <LocationProbe /> },
    ],
    { initialEntries: [initialEntry] },
  )

  return render(
    <AuthProvider api={api}>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

describe('ProtectedRoute', () => {
  it('shows the loading state while the session is unknown', () => {
    renderProtected(
      createFakeAuthApi({
        me: () => new Promise(() => undefined),
      }),
    )

    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i)
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
  })

  it('redirects anonymous visitors to the login page with the intended path', async () => {
    renderProtected(
      createFakeAuthApi({
        me: async () => {
          throw anonymousAuthError()
        },
      }),
    )

    expect(await screen.findByText(/tela de login, origem \/rooms/i)).toBeInTheDocument()
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
  })

  it('renders the private content for an authenticated visitor', async () => {
    renderProtected(createFakeAuthApi())

    expect(await screen.findByText('conteúdo privado')).toBeInTheDocument()
  })

  it('offers a retry when the session check fails', async () => {
    let attempts = 0
    const api = createFakeAuthApi({
      me: async () => {
        attempts += 1
        if (attempts === 1) throw new ApiError(0, 'network_error', 'Sem conexão.', null)
        return TEST_USER
      },
    })

    renderProtected(api)

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível conectar/i)

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(await screen.findByText('conteúdo privado')).toBeInTheDocument()
  })
})
