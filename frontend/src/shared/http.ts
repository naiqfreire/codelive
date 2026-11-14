/**
 * HTTP client for the REST API.
 *
 * - The session lives in an httpOnly cookie owned by the backend, so requests
 *   carry `credentials: 'include'` and the token never reaches JavaScript.
 * - Error responses use the backend envelope `{error:{code,message,request_id}}`.
 * - Failed calls are logged as a structured entry with `timestamp` and
 *   `request_id`. Bodies are never logged: they may contain passwords.
 */

export const NETWORK_ERROR_CODE = 'network_error'
export const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar ao servidor. Tente novamente.'

const FALLBACK_ERROR_CODE = 'internal_error'
const FALLBACK_ERROR_MESSAGE = 'Erro inesperado. Tente novamente.'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null

  constructor(status: number, code: string, message: string, requestId: string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /**
   * Path used in failure logs when the real URL contains a secret (for
   * example, an access code). Request bodies are never logged.
   */
  logPath?: string
}

type ErrorDetails = {
  code: string
  message: string
  requestId: string | null
}

function readErrorEnvelope(payload: unknown): ErrorDetails | null {
  if (typeof payload !== 'object' || payload === null) return null
  const error = (payload as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return null

  const {
    code,
    message,
    request_id: requestId,
  } = error as {
    code?: unknown
    message?: unknown
    request_id?: unknown
  }
  if (typeof code !== 'string') return null

  return {
    code,
    message: typeof message === 'string' ? message : FALLBACK_ERROR_MESSAGE,
    requestId: typeof requestId === 'string' ? requestId : null,
  }
}

function parseJson(text: string): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function logFailure(path: string, method: string, error: ApiError): void {
  console.error('[http]', {
    event: 'request_failed',
    timestamp: new Date().toISOString(),
    request_id: error.requestId,
    method,
    path,
    status: error.status,
    code: error.code,
  })
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, logPath } = options
  const failurePath = logPath ?? path
  const headers: Record<string, string> = { Accept: 'application/json' }
  const init: RequestInit = { method, credentials: 'include', headers }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    const networkError = new ApiError(0, NETWORK_ERROR_CODE, NETWORK_ERROR_MESSAGE, null)
    logFailure(failurePath, method, networkError)
    throw networkError
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T
  }

  const payload = parseJson(await response.text())

  if (!response.ok) {
    const details = readErrorEnvelope(payload)
    const error = new ApiError(
      response.status,
      details?.code ?? FALLBACK_ERROR_CODE,
      details?.message ?? FALLBACK_ERROR_MESSAGE,
      details?.requestId ?? response.headers.get('x-request-id'),
    )
    logFailure(failurePath, method, error)
    throw error
  }

  return payload as T
}
