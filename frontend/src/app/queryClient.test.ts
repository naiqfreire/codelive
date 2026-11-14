import type { Query } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import {
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_KEY,
  QUERY_CACHE_MAX_AGE,
  clearSessionCache,
  createPersistOptions,
  createQueryClient,
  createQueryPersister,
} from './queryClient'

afterEach(() => {
  localStorage.clear()
})

function fakeQuery(queryKey: unknown[], status: string) {
  return { queryKey, state: { status } } as unknown as Query
}

describe('queryClient', () => {
  it('applies the SPEC caching defaults', () => {
    const defaults = createQueryClient().getDefaultOptions()

    expect(defaults.queries?.staleTime).toBe(30_000)
    expect(defaults.queries?.gcTime).toBe(24 * 60 * 60 * 1000)
    expect(defaults.queries?.retry).toBe(1)
    expect(defaults.mutations?.retry).toBe(0)
  })

  it('persists only successful rooms queries', () => {
    const persister = createQueryPersister()
    expect(persister).toBeDefined()

    const options = createPersistOptions(persister!)
    const shouldDehydrate = options.dehydrateOptions?.shouldDehydrateQuery

    expect(options.maxAge).toBe(QUERY_CACHE_MAX_AGE)
    expect(options.buster).toBe(QUERY_CACHE_BUSTER)
    expect(shouldDehydrate?.(fakeQuery(['rooms', 'mine', 'user-1'], 'success'))).toBe(true)
    expect(shouldDehydrate?.(fakeQuery(['rooms', 'mine', 'user-1'], 'error'))).toBe(false)
    expect(shouldDehydrate?.(fakeQuery(['auth', 'me'], 'success'))).toBe(false)
  })

  it('clears both the in-memory and the persisted cache', () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(['rooms', 'mine', 'user-1'], [{ id: 'room-1' }])
    localStorage.setItem(QUERY_CACHE_KEY, '{"clientState":{"mutations":[],"queries":[]}}')

    clearSessionCache(queryClient)

    expect(queryClient.getQueryData(['rooms', 'mine', 'user-1'])).toBeUndefined()
    expect(localStorage.getItem(QUERY_CACHE_KEY)).toBeNull()
  })
})
