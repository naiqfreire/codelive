/**
 * React Query hooks for the rooms slice.
 *
 * Keys include the authenticated user id so a persisted cache never leaks
 * rooms from another account. Mutations update the cached item immediately
 * and then invalidate the list to reconcile with the server.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { roomsApi } from './api'
import type { RoomsApi } from './api'
import type { RoomLanguage } from './languages'
import type { RoomSummary } from './types'

export const roomKeys = {
  all: ['rooms'] as const,
  mine: (userId: string) => ['rooms', 'mine', userId] as const,
}

function replaceRoom(rooms: RoomSummary[] | undefined, updated: RoomSummary) {
  if (!rooms) return rooms
  return rooms.map((room) => (room.id === updated.id ? updated : room))
}

export function useMyRooms(userId: string | null | undefined, api: RoomsApi = roomsApi) {
  return useQuery({
    queryKey: roomKeys.mine(userId ?? 'anonymous'),
    queryFn: () => api.listMine(),
    enabled: Boolean(userId),
  })
}

export function useCreateRoom(userId: string, api: RoomsApi = roomsApi) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (language: RoomLanguage) => api.create(language),
    onSuccess: (room) => {
      queryClient.setQueryData<RoomSummary[]>(roomKeys.mine(userId), (rooms) =>
        rooms ? [room, ...rooms] : rooms,
      )
      return queryClient.invalidateQueries({ queryKey: roomKeys.mine(userId) })
    },
  })
}

function useRoomMutation(
  userId: string,
  mutationFn: (roomId: string) => Promise<RoomSummary>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (room) => {
      queryClient.setQueryData<RoomSummary[]>(roomKeys.mine(userId), (rooms) =>
        replaceRoom(rooms, room),
      )
      return queryClient.invalidateQueries({ queryKey: roomKeys.mine(userId) })
    },
  })
}

export function useCloseRoom(userId: string, api: RoomsApi = roomsApi) {
  return useRoomMutation(userId, (roomId) => api.close(roomId))
}

export function useRegenerateRoomCode(userId: string, api: RoomsApi = roomsApi) {
  return useRoomMutation(userId, (roomId) => api.regenerateCode(roomId))
}
