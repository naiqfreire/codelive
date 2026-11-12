import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/http'
import { AuthProvider } from './AuthProvider'
import type { AuthApi } from './api'
import { useAuth } from './context'
import type { AuthUser } from './types'

const ana: AuthUser = {
  id: '0192f0c0-0000-7000-8000-000000000001',
  name: 'Ana Souza',
  email: 'ana@example.com',
  createdAt: '2026-11-12T10:00:00Z',
}

function notAuthenticated() {
  return new ApiError(401, 'not_authenticated', 'Não autenticado.', 'req-1')
}

function networkFailure() {
  return new ApiError(0, 'network_error', 'Sem conexão.', null)
}

function createApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    me: async () => ana,
    login: async () => ana,
    register: async () => ana,
    logout: async () => undefined,
    ...overrides,
  }
}

function AuthProbe() {
  const { status, user, errorMessage, login, logout, retry } = useAuth()

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.name ?? 'sem usuário'}</span>
      {errorMessage ? <span data-testid="error">{errorMessage}</span> : null}
      <button
        type="button"
        onClick={() => {
          void login({ email: 'ana@example.com', password: 'segredo123' }).catch(() => undefined)
        }}
      >
        entrar
      </button>
      <button
        type="button"
        onClick={() => {
          void logout().catch(() => undefined)
        }}
      >
        sair
      </button>
      <button type="button" onClick={retry}>
        tentar de novo
      </button>
    </div>
  )
}

function renderProbe(api: AuthApi) {
  return render(
    <AuthProvider api={api}>
      <AuthProbe />
    </AuthProvider>,
  )
}

describe('AuthProvider', () => {
  it('starts loading and then authenticates a visitor with an active session', async () => {
    renderProbe(createApi())

    expect(screen.getByTestId('status')).toHaveTextContent('loading')

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })
    expect(screen.getByTestId('user')).toHaveTextContent('Ana Souza')
  })

  it('treats a 401 from the me route as an anonymous visitor', async () => {
    renderProbe(
      createApi({
        me: async () => {
          throw notAuthenticated()
        },
      }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    })
    expect(screen.getByTestId('user')).toHaveTextContent('sem usuário')
    expect(screen.queryByTestId('error')).not.toBeInTheDocument()
  })

  it('reports an unreachable backend and recovers on retry', async () => {
    let attempts = 0
    const api = createApi({
      me: async () => {
        attempts += 1
        if (attempts === 1) throw networkFailure()
        return ana
      },
    })

    renderProbe(api)

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('error')
    })
    expect(screen.getByTestId('error')).toHaveTextContent(/não foi possível conectar/i)

    fireEvent.click(screen.getByRole('button', { name: /tentar de novo/i }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })
    expect(attempts).toBe(2)
  })

  it('returns the user and authenticates after login', async () => {
    const login = vi.fn(async () => ana)
    const api = createApi({
      me: async () => {
        throw notAuthenticated()
      },
      login,
    })

    renderProbe(api)

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    })

    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })
    expect(login).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'segredo123' })
  })

  it('clears the session after logout', async () => {
    const logout = vi.fn(async () => undefined)
    renderProbe(createApi({ logout }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })

    fireEvent.click(screen.getByRole('button', { name: /^sair$/i }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    })
    expect(logout).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('user')).toHaveTextContent('sem usuário')
  })

  it('keeps the session when logout fails', async () => {
    const api = createApi({
      logout: async () => {
        throw new ApiError(500, 'internal_error', 'Erro interno.', 'req-2')
      },
    })
    renderProbe(api)

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })

    fireEvent.click(screen.getByRole('button', { name: /^sair$/i }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })
    expect(screen.getByTestId('user')).toHaveTextContent('Ana Souza')
  })

  it('throws when the hook is used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Orphan() {
      useAuth()
      return null
    }

    expect(() => render(<Orphan />)).toThrow(/AuthProvider/)

    consoleError.mockRestore()
  })
})
