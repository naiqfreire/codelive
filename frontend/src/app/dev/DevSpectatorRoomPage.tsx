import { useParams } from 'react-router-dom'
import SpectatorRoomPage from '../pages/SpectatorRoomPage'
import { findSampleRoom } from './sampleRooms'

/** Development-only entry point that resolves the room from the fixture. */
export default function DevSpectatorRoomPage() {
  const { roomId } = useParams()

  return <SpectatorRoomPage room={findSampleRoom(roomId)} />
}
