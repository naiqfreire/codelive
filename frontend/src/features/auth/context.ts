/** Auth context contract and the hook that reads it. */
import { createContext, useContext } from 'react'
import type { AuthUser, LoginCredentials, RegisterPayload } from './types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export type AuthContextValue = {
  /** `loading` until `GET /api/auth/me` answers; guards must not render meanwhile. */
  status: AuthStatus
  user: AuthUser | null
  /** Present only when `status === 'error'`. */
  errorMessage: string | null
  login: (credentials: LoginCredentials) => Promise<AuthUser>
  register: (payload: RegisterPayload) => Promise<AuthUser>
  logout: () => Promise<void>
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return value
}
