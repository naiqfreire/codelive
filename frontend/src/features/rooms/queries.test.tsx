import { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/http'
import { QueryProvider } from '../../test/query'
import type { RoomsApi } from './api'
import { roomKeys, useCloseRoom, useCreateRoom, useMyRooms, useRegenerateRoomCode } from './queries'
import type { RoomSummary } from './types'

const roomA: RoomSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  accessCode: 'K7M2QX',
  language: 'python',
  status: 'active',
  createdAt: '2026-11-09T17:30:00Z',
}

const roomB: RoomSummary = {
  id: '22222222-2222-2222-2222-222222222222',
  accessCode: 'B4T9RS',
  language: 'java',
  status: 'active',
  createdAt: '2026-11-08T17:30:00Z',
}

const createdRoom: RoomSummary = {
  ...roomA,
  id: '33333333-3333-3333-3333-333333333333',
  accessCode: 'Z2Y8NM',
  language: 'java',
}

function createFakeRoomsApi(overrides: Partial<RoomsApi> = {}): RoomsApi {
  return {
    listMine: vi.fn(async () => [roomA, roomB]),
    create: vi.fn(async (language) => ({ ...createdRoom, language })),
    close: vi.fn(async () => ({ ...roomA, status: 'closed' as const })),
    regenerateCode: vi.fn(async () => ({ ...roomA, accessCode: 'H5P1VC' })),
    ...overrides,
  }
}

function setup(queryClient = new QueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryProvider client={queryClient}>{children}</QueryProvider>
  )
  return { queryClient, wrapper }
}

describe('room queries', () => {
  it('builds a per-user query key', () => {
    expect(roomKeys.mine('user-1')).toEqual(['rooms', 'mine', 'user-1'])
  })

  it('loads the owner rooms', async () => {
    const api = createFakeRoomsApi()
    const { wrapper } = setup()

    const { result } = renderHook(() => useMyRooms('user-1', api), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([roomA, roomB])
    expect(api.listMine).toHaveBeenCalledTimes(1)
  })

  it('does not fetch without an authenticated user', async () => {
    const api = createFakeRoomsApi()
    const { wrapper } = setup()

    const { result } = renderHook(() => useMyRooms(null, api), { wrapper })

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(api.listMine).not.toHaveBeenCalled()
  })

  it('prepends the created room and reconciles with the server list', async () => {
    const api = createFakeRoomsApi({
      listMine: vi.fn(async () => [createdRoom, roomA]),
    })
    const { queryClient, wrapper } = setup()
    queryClient.setQueryData(roomKeys.mine('user-1'), [roomA])

    const { result } = renderHook(() => useCreateRoom('user-1', api), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('java')
    })

    expect(api.create).toHaveBeenCalledWith('java')
    await waitFor(() => {
      expect(queryClient.getQueryData(roomKeys.mine('user-1'))).toEqual([createdRoom, roomA])
    })
  })

  it('replaces the closed room in the cache', async () => {
    const closedRoom = { ...roomA, status: 'closed' as const }
    const api = createFakeRoomsApi({
      listMine: vi.fn(async () => [closedRoom, roomB]),
    })
    const { queryClient, wrapper } = setup()
    queryClient.setQueryData(roomKeys.mine('user-1'), [roomA, roomB])

    const { result } = renderHook(() => useCloseRoom('user-1', api), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(roomA.id)
    })

    expect(api.close).toHaveBeenCalledWith(roomA.id)
    await waitFor(() => {
      expect(queryClient.getQueryData(roomKeys.mine('user-1'))).toEqual([closedRoom, roomB])
    })
  })

  it('replaces the regenerated code in the cache', async () => {
    const regenerated = { ...roomA, accessCode: 'H5P1VC' }
    const api = createFakeRoomsApi({
      listMine: vi.fn(async () => [regenerated, roomB]),
    })
    const { queryClient, wrapper } = setup()
    queryClient.setQueryData(roomKeys.mine('user-1'), [roomA, roomB])

    const { result } = renderHook(() => useRegenerateRoomCode('user-1', api), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(roomA.id)
    })

    expect(api.regenerateCode).toHaveBeenCalledWith(roomA.id)
    await waitFor(() => {
      expect(queryClient.getQueryData(roomKeys.mine('user-1'))).toEqual([regenerated, roomB])
    })
  })

  it('propagates mutation failures', async () => {
    const failure = new ApiError(500, 'internal_error', 'Erro.', 'req-1')
    const api = createFakeRoomsApi({ create: vi.fn(async () => Promise.reject(failure)) })
    const { wrapper } = setup()

    const { result } = renderHook(() => useCreateRoom('user-1', api), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync('python')).rejects.toBe(failure)
    })
  })
})
