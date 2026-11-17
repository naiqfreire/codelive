import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth'
import type { AuthApi } from '../../features/auth'
import { ApiError } from '../../shared/http'
import { anonymousAuthError, createFakeAuthApi } from '../../test/auth'
import { AppShell } from './AppShell'

function anonymousApi(): AuthApi {
  return createFakeAuthApi({
    me: async () => {
      throw anonymousAuthError()
    },
  })
}

function renderShell(
  api: AuthApi = createFakeAuthApi(),
  initialEntries: string[] = ['/rooms'],
) {
  const router = createMemoryRouter(
    [
      {
        path: '/rooms',
        element: <AppShell />,
        children: [
          { index: true, element: <p>Conteúdo roteado</p> },
          { path: 'join', element: <p>tela do código</p> },
          { path: 'joined', element: <p>tela participei</p> },
        ],
      },
      { path: '/login', element: <p>tela de login</p> },
    ],
    { initialEntries },
  )

  return render(
    <AuthProvider api={api}>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
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

  it('links to the access-code step', async () => {
    renderShell()

    const enterWithCode = await screen.findByRole('link', { name: /entrar com código/i })

    expect(enterWithCode).toHaveAttribute('href', '/rooms/join')
  })

  it('marks the access-code section with aria-current page', async () => {
    renderShell(undefined, ['/rooms/join'])

    expect(await screen.findByText('tela do código')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /entrar com código/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: /minhas salas/i })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('keeps "Minhas salas" current on the joined rooms list', async () => {
    renderShell(undefined, ['/rooms/joined'])

    expect(await screen.findByText('tela participei')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /minhas salas/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: /entrar com código/i })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('shows the authenticated user name', async () => {
    renderShell()

    expect(await screen.findByText(/ana souza/i)).toBeInTheDocument()
  })

  it('logs out and returns to the login page', async () => {
    const logout = vi.fn(async () => undefined)
    renderShell(createFakeAuthApi({ logout }))

    fireEvent.click(await screen.findByRole('button', { name: /^sair$/i }))

    expect(await screen.findByText('tela de login')).toBeInTheDocument()
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('keeps the user signed in and reports a logout failure', async () => {
    renderShell(
      createFakeAuthApi({
        logout: async () => {
          throw new ApiError(500, 'internal_error', 'Erro interno.', 'req-1')
        },
      }),
    )

    fireEvent.click(await screen.findByRole('button', { name: /^sair$/i }))

    expect(
      await screen.findByText('Não foi possível sair. Tente novamente.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Conteúdo roteado')).toBeInTheDocument()
  })

  it('offers the access-code entry to an anonymous visitor', async () => {
    renderShell(anonymousApi(), ['/rooms/join'])

    expect(await screen.findByRole('link', { name: /entrar com código/i })).toHaveAttribute(
      'href',
      '/rooms/join',
    )
    expect(screen.getByText('tela do código')).toBeInTheDocument()
  })

  it('hides the owner navigation and the logout action for an anonymous visitor', async () => {
    renderShell(anonymousApi(), ['/rooms/join'])

    await screen.findByRole('link', { name: /entrar com código/i })

    expect(screen.queryByRole('link', { name: /minhas salas/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^sair$/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/olá,/i)).not.toBeInTheDocument()
  })

  it('links an anonymous visitor to the login page', async () => {
    renderShell(anonymousApi(), ['/rooms/join'])

    expect(await screen.findByRole('link', { name: /^entrar$/i })).toHaveAttribute(
      'href',
      '/login',
    )
  })
})
