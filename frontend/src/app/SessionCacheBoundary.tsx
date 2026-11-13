/**
 * Clears cached rooms when the authenticated identity changes.
 *
 * A session restored on page load must keep the persisted cache, so the
 * boundary only acts after the auth status leaves `loading` and the user id
 * actually changes (logout or a different account).
 */
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth'
import { clearSessionCache } from './queryClient'

export function SessionCacheBoundary() {
  const { status, user } = useAuth()
  const queryClient = useQueryClient()
  const previousUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (status === 'loading') return

    const currentUserId = status === 'authenticated' ? (user?.id ?? null) : null
    if (previousUserId.current !== undefined && previousUserId.current !== currentUserId) {
      clearSessionCache(queryClient)
    }
    previousUserId.current = currentUserId
  }, [status, user?.id, queryClient])

  return null
}
