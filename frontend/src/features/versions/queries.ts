/**
 * React Query hooks for the versions slice.
 *
 * The list is cached per room and kept in memory only: it changes every 30 s
 * while the room is edited, so persisting it would mostly serve stale history.
 * The restore invalidates the list so the new version shows up immediately.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { versionsApi } from './api'
import type { VersionsApi } from './api'

export const versionKeys = {
  all: ['versions'] as const,
  list: (roomId: string) => ['versions', roomId] as const,
}

export function useRoomVersions(roomId: string | null | undefined, api: VersionsApi = versionsApi) {
  const id = roomId ?? ''

  return useQuery({
    queryKey: versionKeys.list(id),
    queryFn: () => api.list(id),
    enabled: id !== '',
  })
}

export function useRestoreVersion(roomId: string, api: VersionsApi = versionsApi) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (versionId: string) => api.restore(roomId, versionId),
    // Fire-and-forget: the panel announces and updates the editor as soon as
    // the restore resolves, while the list reconciles in the background.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: versionKeys.list(roomId) })
    },
  })
}
