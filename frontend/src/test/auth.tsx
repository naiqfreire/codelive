/**
 * Test-only helpers for the auth slice.
 *
 * Tests inject a fake service layer into `AuthProvider` instead of stubbing
 * `fetch`, so the provider logic runs for real and no test touches the network.
 */
import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ApiError } from '../shared/http'
import { AuthProvider } from '../features/auth/AuthProvider'
import type { AuthApi } from '../features/auth/api'
import type { AuthUser } from '../features/auth/types'

export const TEST_USER: AuthUser = {
  id: '0192f0c0-0000-7000-8000-000000000001',
  name: 'Ana Souza',
  email: 'ana@example.com',
  createdAt: '2026-11-12T10:00:00Z',
}

export function anonymousAuthError(): ApiError {
  return new ApiError(401, 'not_authenticated', 'Não autenticado.', 'req-test')
}

export function createFakeAuthApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    me: async () => TEST_USER,
    login: async () => TEST_USER,
    register: async () => TEST_USER,
    logout: async () => undefined,
    ...overrides,
  }
}

export function renderWithAuth(ui: ReactElement, api: AuthApi = createFakeAuthApi()): RenderResult {
  return render(<AuthProvider api={api}>{ui}</AuthProvider>)
}
