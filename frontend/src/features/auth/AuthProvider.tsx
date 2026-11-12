/**
 * Session provider.
 *
 * The session token is an httpOnly cookie owned by the backend: this provider
 * never stores it. The authenticated state is derived from `GET /api/auth/me`,
 * so a page reload or a second tab stays in sync with the server.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '../../shared/http'
import { authApi } from './api'
import type { AuthApi } from './api'
import { AuthContext } from './context'
import type { AuthContextValue, AuthStatus } from './context'
import { authErrorMessage } from './messages'
import type { AuthUser, LoginCredentials, RegisterPayload } from './types'

const SESSION_CHECK_FALLBACK = 'Não foi possível verificar sua sessão. Tente novamente.'

type AuthProviderProps = {
  children: ReactNode
  /** Test seam: lets a test replace the service layer instead of stubbing fetch. */
  api?: AuthApi
}

export function AuthProvider({ children, api = authApi }: AuthProviderProps) {
  const apiRef = useRef(api)
  apiRef.current = api

  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    setStatus('loading')
    setErrorMessage(null)

    apiRef.current
      .me()
      .then((currentUser) => {
        if (!active) return
        setUser(currentUser)
        setStatus('authenticated')
      })
      .catch((error: unknown) => {
        if (!active) return
        setUser(null)
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.code === 'not_authenticated')
        ) {
          setStatus('anonymous')
          return
        }
        setErrorMessage(authErrorMessage(error, SESSION_CHECK_FALLBACK))
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setAttempt((current) => current + 1)
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    const currentUser = await apiRef.current.login(credentials)
    setUser(currentUser)
    setErrorMessage(null)
    setStatus('authenticated')
    return currentUser
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const currentUser = await apiRef.current.register(payload)
    setUser(currentUser)
    setErrorMessage(null)
    setStatus('authenticated')
    return currentUser
  }, [])

  const logout = useCallback(async () => {
    await apiRef.current.logout()
    setUser(null)
    setErrorMessage(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, errorMessage, login, register, logout, retry }),
    [status, user, errorMessage, login, register, logout, retry],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
