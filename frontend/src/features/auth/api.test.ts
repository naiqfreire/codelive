import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/http'
import { authApi } from './api'

const fetchMock = vi.fn()

const wireUser = {
  id: '0192f0c0-0000-7000-8000-000000000001',
  name: 'Ana Souza',
  email: 'ana@example.com',
  created_at: '2026-11-12T10:00:00Z',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function errorResponse(code: string, status: number) {
  return jsonResponse({ error: { code, message: 'Falhou.', request_id: 'req-1' } }, status)
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authApi', () => {
  it('posts the credentials to the login route and maps the wire user', async () => {
    fetchMock.mockResolvedValue(jsonResponse(wireUser))

    const user = await authApi.login({ email: 'ana@example.com', password: 'segredo123' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'ana@example.com', password: 'segredo123' }),
      }),
    )
    expect(user).toEqual({
      id: wireUser.id,
      name: 'Ana Souza',
      email: 'ana@example.com',
      createdAt: '2026-11-12T10:00:00Z',
    })
    expect(user).not.toHaveProperty('created_at')
  })

  it('posts the registration payload to the register route', async () => {
    fetchMock.mockResolvedValue(jsonResponse(wireUser, 201))

    await authApi.register({
      name: 'Ana Souza',
      email: 'ana@example.com',
      password: 'segredo123',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Ana Souza',
          email: 'ana@example.com',
          password: 'segredo123',
        }),
      }),
    )
  })

  it('reads the current user from the me route', async () => {
    fetchMock.mockResolvedValue(jsonResponse(wireUser))

    await expect(authApi.me()).resolves.toMatchObject({ id: wireUser.id })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  it('posts to the logout route', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(authApi.logout()).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('treats an already expired session as a successful logout', async () => {
    fetchMock.mockResolvedValue(errorResponse('not_authenticated', 401))

    await expect(authApi.logout()).resolves.toBeUndefined()
  })

  it('propagates other logout failures', async () => {
    fetchMock.mockResolvedValue(errorResponse('internal_error', 500))

    await expect(authApi.logout()).rejects.toBeInstanceOf(ApiError)
  })
})
