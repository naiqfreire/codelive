import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { anonymousAuthError, createFakeAuthApi } from '../../test/auth'
import { AuthProvider } from './AuthProvider'
import type { AuthApi } from './api'
import { GuestRoute } from './GuestRoute'

function renderGuest(api: AuthApi, initialEntry = '/login') {
  const router = createMemoryRouter(
    [
      {
        element: <GuestRoute />,
        children: [{ path: '/login', element: <p>formulário de login</p> }],
      },
      { path: '/rooms', element: <p>minhas salas</p> },
    ],
    { initialEntries: [initialEntry] },
  )

  return render(
    <AuthProvider api={api}>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

describe('GuestRoute', () => {
  it('shows the loading state while the session is unknown', () => {
    renderGuest(
      createFakeAuthApi({
        me: () => new Promise(() => undefined),
      }),
    )

    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i)
    expect(screen.queryByText('formulário de login')).not.toBeInTheDocument()
  })

  it('renders the public page for anonymous visitors', async () => {
    renderGuest(
      createFakeAuthApi({
        me: async () => {
          throw anonymousAuthError()
        },
      }),
    )

    expect(await screen.findByText('formulário de login')).toBeInTheDocument()
  })

  it('redirects an authenticated visitor to the room list', async () => {
    renderGuest(createFakeAuthApi())

    expect(await screen.findByText('minhas salas')).toBeInTheDocument()
    expect(screen.queryByText('formulário de login')).not.toBeInTheDocument()
  })

  it('keeps the public page available when the session check fails', async () => {
    renderGuest(
      createFakeAuthApi({
        me: async () => {
          throw new Error('backend fora do ar')
        },
      }),
    )

    expect(await screen.findByText('formulário de login')).toBeInTheDocument()
  })
})
