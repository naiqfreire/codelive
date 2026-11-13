/**
 * Query cache configuration (SPEC §10).
 *
 * Only non-volatile REST responses are persisted. The live code never goes
 * through this cache: it comes from the WebSocket. The session token is an
 * httpOnly cookie and is never stored here.
 */
import { QueryClient } from '@tanstack/react-query'
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const QUERY_CACHE_KEY = 'codelive:query-cache'
export const QUERY_CACHE_BUSTER = 'v1'
export const QUERY_STALE_TIME = 30_000
export const QUERY_GC_TIME = 24 * 60 * 60 * 1000
export const QUERY_CACHE_MAX_AGE = 24 * 60 * 60 * 1000

type Persister = ReturnType<typeof createSyncStoragePersister>
type PersistOptions = PersistQueryClientProviderProps['persistOptions']

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME,
        gcTime: QUERY_GC_TIME,
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

export function createQueryPersister(): Persister | undefined {
  if (typeof window === 'undefined' || !window.localStorage) return undefined

  return createSyncStoragePersister({
    storage: window.localStorage,
    key: QUERY_CACHE_KEY,
  })
}

export function createPersistOptions(persister: Persister): PersistOptions {
  return {
    persister,
    maxAge: QUERY_CACHE_MAX_AGE,
    buster: QUERY_CACHE_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        query.queryKey[0] === 'rooms' && query.state.status === 'success',
    },
  }
}

/** Drops the in-memory cache and the persisted copy (logout / user switch). */
export function clearSessionCache(queryClient: QueryClient): void {
  queryClient.clear()
  createQueryPersister()?.removeClient()
}
