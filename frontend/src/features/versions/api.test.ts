import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/http'
import { toCodeVersion, toRestoredVersion, versionsApi } from './api'

const fetchMock = vi.fn()

const ROOM_ID = '11111111-1111-1111-1111-111111111111'
const VERSION_ID = '22222222-2222-2222-2222-222222222222'
const NEW_VERSION_ID = '33333333-3333-3333-3333-333333333333'

const wireVersion = {
  id: VERSION_ID,
  created_at: '2026-11-10T12:00:00Z',
  content_hash: 'a'.repeat(64),
  language: 'python' as const,
  author_id: null,
}

const wireAuthoredVersion = {
  ...wireVersion,
  id: NEW_VERSION_ID,
  author_id: '44444444-4444-4444-4444-444444444444',
}

const wireRestore = {
  content: "print('restaurado')\n",
  content_hash: 'a'.repeat(64),
  id: NEW_VERSION_ID,
  created_at: '2026-11-10T12:05:00Z',
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

describe('toCodeVersion', () => {
  it('maps the wire payload and keeps a job-written author as null', () => {
    expect(toCodeVersion(wireVersion)).toEqual({
      id: VERSION_ID,
      createdAt: '2026-11-10T12:00:00Z',
      contentHash: 'a'.repeat(64),
      language: 'python',
      authorId: null,
    })
  })

  it('keeps the author of an authored version', () => {
    expect(toCodeVersion(wireAuthoredVersion).authorId).toBe('44444444-4444-4444-4444-444444444444')
  })

  it('never exposes the snake_case wire keys', () => {
    const version = toCodeVersion(wireVersion)

    expect(version).not.toHaveProperty('created_at')
    expect(version).not.toHaveProperty('content_hash')
    expect(version).not.toHaveProperty('author_id')
  })
})

describe('toRestoredVersion', () => {
  it('maps the restore response, including the restored content', () => {
    expect(toRestoredVersion(wireRestore)).toEqual({
      content: "print('restaurado')\n",
      contentHash: 'a'.repeat(64),
      id: NEW_VERSION_ID,
      createdAt: '2026-11-10T12:05:00Z',
    })
  })
})

describe('versionsApi', () => {
  it('lists the versions of a room', async () => {
    fetchMock.mockResolvedValue(jsonResponse([wireVersion, wireAuthoredVersion]))

    const versions = await versionsApi.list(ROOM_ID)

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/rooms/${ROOM_ID}/versions`,
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
    expect(versions).toEqual([
      {
        id: VERSION_ID,
        createdAt: '2026-11-10T12:00:00Z',
        contentHash: 'a'.repeat(64),
        language: 'python',
        authorId: null,
      },
      {
        id: NEW_VERSION_ID,
        createdAt: '2026-11-10T12:00:00Z',
        contentHash: 'a'.repeat(64),
        language: 'python',
        authorId: '44444444-4444-4444-4444-444444444444',
      },
    ])
  })

  it('encodes the room id in the list path', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await versionsApi.list('room with space')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rooms/room%20with%20space/versions',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('restores a version with a POST and no body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(wireRestore))

    const restored = await versionsApi.restore(ROOM_ID, VERSION_ID)

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/rooms/${ROOM_ID}/versions/${VERSION_ID}/restore`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.body).toBeUndefined()
    expect(restored.content).toBe("print('restaurado')\n")
    expect(restored.id).toBe(NEW_VERSION_ID)
  })

  it('propagates a forbidden listing as an ApiError', async () => {
    fetchMock.mockImplementation(async () => errorResponse('forbidden', 403))

    await expect(versionsApi.list(ROOM_ID)).rejects.toBeInstanceOf(ApiError)
    await expect(versionsApi.list(ROOM_ID)).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
    })
  })

  it('propagates a closed room restore', async () => {
    fetchMock.mockImplementation(async () => errorResponse('room_closed', 409))

    await expect(versionsApi.restore(ROOM_ID, VERSION_ID)).rejects.toMatchObject({
      code: 'room_closed',
      status: 409,
    })
  })

  it('propagates an unknown version', async () => {
    fetchMock.mockImplementation(async () => errorResponse('version_not_found', 404))

    await expect(versionsApi.restore(ROOM_ID, VERSION_ID)).rejects.toMatchObject({
      code: 'version_not_found',
      status: 404,
    })
  })
})
