import { useParams } from 'react-router-dom'
import OwnerRoomPage from '../pages/OwnerRoomPage'
import { findSampleRoom } from './sampleRooms'

/** Development-only entry point that resolves the room from the fixture. */
export default function DevOwnerRoomPage() {
  const { roomId } = useParams()

  return <OwnerRoomPage room={findSampleRoom(roomId)} />
}
