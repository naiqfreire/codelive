/** Composition: wires the room list to the API, the query cache and the auth session. */
import { useAuth } from '../../features/auth'
import {
  roomsApi,
  roomsErrorMessage,
  useCloseRoom,
  useCreateRoom,
  useMyRooms,
  useRegenerateRoomCode,
} from '../../features/rooms'
import type { RoomLanguage, RoomSummary, RoomsApi } from '../../features/rooms'
import { ApiError } from '../../shared/http'
import RoomListPage from '../pages/RoomListPage'

const LOAD_ERROR_FALLBACK = 'Não foi possível carregar suas salas. Tente novamente.'

type RoomListRouteProps = {
  api?: RoomsApi
}

export default function RoomListRoute({ api = roomsApi }: RoomListRouteProps) {
  const { user, logout } = useAuth()
  const userId = user?.id ?? ''

  const roomsQuery = useMyRooms(user?.id, api)
  const createRoom = useCreateRoom(userId, api)
  const closeRoom = useCloseRoom(userId, api)
  const regenerateCode = useRegenerateRoomCode(userId, api)

  const error = roomsQuery.error
  const isSessionExpired = error instanceof ApiError && error.status === 401
  const errorMessage = error ? roomsErrorMessage(error, LOAD_ERROR_FALLBACK) : null

  function handleRetry() {
    if (isSessionExpired) {
      void logout()
      return
    }
    void roomsQuery.refetch()
  }

  const handleCreate = (language: RoomLanguage): Promise<RoomSummary> =>
    createRoom.mutateAsync(language)
  const handleClose = (room: RoomSummary): Promise<RoomSummary> => closeRoom.mutateAsync(room.id)
  const handleRegenerate = (room: RoomSummary): Promise<RoomSummary> =>
    regenerateCode.mutateAsync(room.id)

  return (
    <RoomListPage
      rooms={roomsQuery.data ?? []}
      isLoading={roomsQuery.isLoading}
      errorMessage={errorMessage}
      isSessionExpired={isSessionExpired}
      onRetry={handleRetry}
      onCreateRoom={handleCreate}
      onCloseRoom={handleClose}
      onRegenerateCode={handleRegenerate}
    />
  )
}