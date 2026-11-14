/** Composition: wires the code entry screen to the rooms API and the router. */
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth'
import { roomsApi } from '../../features/rooms'
import type { RoomLookup, RoomsApi } from '../../features/rooms'
import CodeEntryPage from '../pages/CodeEntryPage'

type CodeEntryRouteProps = {
  api?: RoomsApi
}

type CodeEntryLocationState = {
  code?: unknown
}

function readInitialCode(state: unknown): string | undefined {
  if (!state || typeof state !== 'object') return undefined

  const code = (state as CodeEntryLocationState).code
  return typeof code === 'string' ? code : undefined
}

export default function CodeEntryRoute({ api = roomsApi }: CodeEntryRouteProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()

  function handleSubmit(code: string): Promise<RoomLookup> {
    return api.getByCode(code)
  }

  function handleValidRoom(room: RoomLookup) {
    navigate(`/rooms/${room.id}/join`, { state: { room } })
  }

  async function handleSessionExpired() {
    try {
      await logout()
    } finally {
      navigate('/login', { state: { from: '/rooms/join' } })
    }
  }

  return (
    <CodeEntryPage
      initialCode={readInitialCode(location.state)}
      onSubmit={handleSubmit}
      onValidRoom={handleValidRoom}
      onSessionExpired={handleSessionExpired}
    />
  )
}
