import { useParams } from 'react-router-dom'
import SpectatorRoomPage from '../pages/SpectatorRoomPage'
import { useDevRoomConnection } from './devConnection'
import { findSampleRoom, SAMPLE_PARTICIPANTS } from './sampleRooms'

/** Development-only entry point that resolves the room from the fixture. */
export default function DevSpectatorRoomPage() {
  const { roomId } = useParams()
  const room = findSampleRoom(roomId)
  const connection = useDevRoomConnection(room, 'viewer')

  return (
    <SpectatorRoomPage
      room={room}
      connection={connection}
      participants={SAMPLE_PARTICIPANTS}
    />
  )
}
