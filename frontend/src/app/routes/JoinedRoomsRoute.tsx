/** Composition: wires the joined rooms list to the API, cache and auth session. */
import { useAuth } from '../../features/auth'
import { roomsApi, roomsErrorMessage, useJoinedRooms } from '../../features/rooms'
import type { RoomsApi } from '../../features/rooms'
import { ApiError } from '../../shared/http'
import JoinedRoomsPage from '../pages/JoinedRoomsPage'

const LOAD_ERROR_FALLBACK = 'Não foi possível carregar as salas que você participou. Tente novamente.'

type JoinedRoomsRouteProps = {
  api?: RoomsApi
}

export default function JoinedRoomsRoute({ api = roomsApi }: JoinedRoomsRouteProps) {
  const { user, logout } = useAuth()

  const roomsQuery = useJoinedRooms(user?.id, api)

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

  return (
    <JoinedRoomsPage
      rooms={roomsQuery.data ?? []}
      isLoading={roomsQuery.isLoading}
      errorMessage={errorMessage}
      isSessionExpired={isSessionExpired}
      onRetry={handleRetry}
    />
  )
}
