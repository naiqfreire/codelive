import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/http'
import { roomsApi } from './api'

const fetchMock = vi.fn()

const wireRoom = {
  id: '11111111-1111-1111-1111-111111111111',
  access_code: 'K7M2QX',
  language: 'python',
  status: 'active',
  created_at: '2026-11-09T17:30:00Z',
}

const wireLookup = {
  ...wireRoom,
  owner_id: '22222222-2222-2222-2222-222222222222',
  updated_at: '2026-11-10T10:00:00Z',
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

describe('roomsApi', () => {
  it('lists the owner rooms and maps the wire payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse([wireRoom]))

    const rooms = await roomsApi.listMine()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rooms/mine',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
    expect(rooms).toEqual([
      {
        id: wireRoom.id,
        accessCode: 'K7M2QX',
        language: 'python',
        status: 'active',
        createdAt: '2026-11-09T17:30:00Z',
      },
    ])
    expect(rooms[0]).not.toHaveProperty('access_code')
    expect(rooms[0]).not.toHaveProperty('created_at')
  })

  it('creates a room with the chosen language', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...wireRoom, language: 'java' }, 201))

    const room = await roomsApi.create('java')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rooms',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ language: 'java' }),
      }),
    )
    expect(room.language).toBe('java')
  })

  it('closes a room', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...wireRoom, status: 'closed' }))

    const room = await roomsApi.close(wireRoom.id)

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/rooms/${wireRoom.id}/close`,
      expect.objectContaining({ method: 'PATCH', credentials: 'include' }),
    )
    expect(room.status).toBe('closed')
  })

  it('regenerates the access code', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...wireRoom, access_code: 'B4T9RS' }))

    const room = await roomsApi.regenerateCode(wireRoom.id)

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/rooms/${wireRoom.id}/regenerate-code`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    expect(room.accessCode).toBe('B4T9RS')
  })

  it('looks up a room by access code and maps the wire payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse(wireLookup))

    const room = await roomsApi.getByCode('K7M2QX')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rooms/by-code/K7M2QX',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
    expect(room).toEqual({
      id: wireLookup.id,
      accessCode: 'K7M2QX',
      language: 'python',
      status: 'active',
      createdAt: '2026-11-09T17:30:00Z',
      ownerId: wireLookup.owner_id,
      updatedAt: '2026-11-10T10:00:00Z',
    })
    expect(room).not.toHaveProperty('owner_id')
    expect(room).not.toHaveProperty('updated_at')
  })

  it('encodes the code in the lookup path', async () => {
    fetchMock.mockResolvedValue(jsonResponse(wireLookup))

    await roomsApi.getByCode('A B')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rooms/by-code/A%20B',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('propagates a missing code as an ApiError', async () => {
    fetchMock.mockImplementation(async () => errorResponse('room_not_found', 404))

    await expect(roomsApi.getByCode('ZZZZZZ')).rejects.toMatchObject({
      code: 'room_not_found',
      status: 404,
    })
  })

  it('propagates API errors', async () => {
    fetchMock.mockImplementation(async () => errorResponse('room_closed', 409))

    await expect(roomsApi.regenerateCode(wireRoom.id)).rejects.toBeInstanceOf(ApiError)
    await expect(roomsApi.regenerateCode(wireRoom.id)).rejects.toMatchObject({
      code: 'room_closed',
      status: 409,
    })
  })
})
