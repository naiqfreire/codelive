import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './http'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('apiRequest', () => {
  it('parses the JSON body of a successful response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }))

    await expect(apiRequest('/api/health')).resolves.toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  it('sends the body as JSON with the matching content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'u1' }, 201))

    await apiRequest('/api/auth/register', {
      method: 'POST',
      body: { email: 'aluno@example.com' },
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ email: 'aluno@example.com' }))
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('returns undefined for a 204 response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiRequest('/api/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('throws an ApiError built from the error envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'invalid_credentials',
            message: 'Credenciais inválidas.',
            request_id: 'req-1',
          },
        },
        401,
      ),
    )

    const error = await apiRequest('/api/auth/login', { method: 'POST', body: {} }).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 401,
      code: 'invalid_credentials',
      message: 'Credenciais inválidas.',
      requestId: 'req-1',
    })
  })

  it('falls back to the x-request-id header when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>bad gateway</html>', {
        status: 502,
        headers: { 'x-request-id': 'req-2' },
      }),
    )

    await expect(apiRequest('/api/rooms')).rejects.toMatchObject({
      status: 502,
      code: 'internal_error',
      requestId: 'req-2',
    })
  })

  it('maps a network failure to an ApiError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(apiRequest('/api/auth/me')).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
      requestId: null,
    })
  })

  it('logs the failure without leaking the request body', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'invalid_credentials',
            message: 'Credenciais inválidas.',
            request_id: 'req-3',
          },
        },
        401,
      ),
    )

    await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'aluno@example.com', password: 'segredo-super-secreto' },
    }).catch(() => undefined)

    expect(consoleError).toHaveBeenCalledTimes(1)
    const [scope, entry] = consoleError.mock.calls[0] as [string, Record<string, unknown>]
    expect(scope).toBe('[http]')
    expect(entry).toMatchObject({
      event: 'request_failed',
      request_id: 'req-3',
      method: 'POST',
      path: '/api/auth/login',
      status: 401,
      code: 'invalid_credentials',
    })
    expect(typeof entry.timestamp).toBe('string')
    expect(JSON.stringify(entry)).not.toContain('segredo-super-secreto')
  })
})
