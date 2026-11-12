/**
 * Service layer for the auth slice: every HTTP call of this feature lives here.
 * Components and the context never call `fetch` directly.
 */
import { ApiError, apiRequest } from '../../shared/http'
import type { AuthUser, LoginCredentials, RegisterPayload, UserResponse } from './types'

export type AuthApi = {
  login(credentials: LoginCredentials): Promise<AuthUser>
  register(payload: RegisterPayload): Promise<AuthUser>
  logout(): Promise<void>
  me(): Promise<AuthUser>
}

function toAuthUser(user: UserResponse): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  }
}

export const authApi: AuthApi = {
  async login(credentials) {
    const user = await apiRequest<UserResponse>('/api/auth/login', {
      method: 'POST',
      body: credentials,
    })
    return toAuthUser(user)
  },

  async register(payload) {
    const user = await apiRequest<UserResponse>('/api/auth/register', {
      method: 'POST',
      body: payload,
    })
    return toAuthUser(user)
  },

  async logout() {
    try {
      await apiRequest<void>('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      // The session expired before the request: the goal (no session) is met.
      if (error instanceof ApiError && error.status === 401) return
      throw error
    }
  },

  async me() {
    return toAuthUser(await apiRequest<UserResponse>('/api/auth/me'))
  },
}
