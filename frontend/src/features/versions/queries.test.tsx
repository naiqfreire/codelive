import { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/http'
import { QueryProvider } from '../../test/query'
import type { VersionsApi } from './api'
import { useRestoreVersion, useRoomVersions, versionKeys } from './queries'
import type { CodeVersion, RestoredVersion } from './types'

const ROOM_ID = '11111111-1111-1111-1111-111111111111'
const VERSION_ID = '22222222-2222-2222-2222-222222222222'

const versionA: CodeVersion = {
  id: VERSION_ID,
  createdAt: '2026-11-10T12:00:00Z',
  contentHash: 'a'.repeat(64),
  language: 'python',
  authorId: null,
}

const versionB: CodeVersion = {
  id: '33333333-3333-3333-3333-333333333333',
  createdAt: '2026-11-10T12:05:00Z',
  contentHash: 'b'.repeat(64),
  language: 'python',
  authorId: '44444444-4444-4444-4444-444444444444',
}

const restored: RestoredVersion = {
  content: "print('restaurado')\n",
  contentHash: versionA.contentHash,
  id: '55555555-5555-5555-5555-555555555555',
  createdAt: '2026-11-10T12:10:00Z',
}

function createFakeVersionsApi(overrides: Partial<VersionsApi> = {}): VersionsApi {
  return {
    list: vi.fn(async () => [versionA, versionB]),
    restore: vi.fn(async () => restored),
    ...overrides,
  }
}

function setup(queryClient = new QueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryProvider client={queryClient}>{children}</QueryProvider>
  )
  return { queryClient, wrapper }
}

describe('version queries', () => {
  it('builds a per-room query key', () => {
    expect(versionKeys.list(ROOM_ID)).toEqual(['versions', ROOM_ID])
  })

  it('loads the versions of a room', async () => {
    const api = createFakeVersionsApi()
    const { wrapper } = setup()

    const { result } = renderHook(() => useRoomVersions(ROOM_ID, api), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([versionA, versionB])
    expect(api.list).toHaveBeenCalledWith(ROOM_ID)
  })

  it('does not fetch without a room id', async () => {
    const api = createFakeVersionsApi()
    const { wrapper } = setup()

    const { result } = renderHook(() => useRoomVersions(null, api), { wrapper })

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(api.list).not.toHaveBeenCalled()
  })

  it('restores a version and marks the list stale', async () => {
    const api = createFakeVersionsApi()
    const { queryClient, wrapper } = setup()
    queryClient.setQueryData(versionKeys.list(ROOM_ID), [versionA, versionB])

    const { result } = renderHook(() => useRestoreVersion(ROOM_ID, api), { wrapper })

    let outcome: RestoredVersion | undefined
    await act(async () => {
      outcome = await result.current.mutateAsync(VERSION_ID)
    })

    expect(api.restore).toHaveBeenCalledWith(ROOM_ID, VERSION_ID)
    expect(outcome).toEqual(restored)
    await waitFor(() => {
      expect(queryClient.getQueryState(versionKeys.list(ROOM_ID))?.isInvalidated).toBe(true)
    })
  })

  it('propagates restore failures', async () => {
    const failure = new ApiError(409, 'room_closed', 'Fechada.', 'req-1')
    const api = createFakeVersionsApi({
      restore: vi.fn(async () => Promise.reject(failure)),
    })
    const { wrapper } = setup()

    const { result } = renderHook(() => useRestoreVersion(ROOM_ID, api), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync(VERSION_ID)).rejects.toBe(failure)
    })
  })
})
