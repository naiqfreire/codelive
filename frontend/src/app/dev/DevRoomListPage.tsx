import RoomListPage from '../pages/RoomListPage'
import { SAMPLE_JOINED_ROOMS, SAMPLE_ROOMS } from './sampleRooms'

/** Development-only entry point that feeds the layout with the fixture. */
export default function DevRoomListPage() {
  return <RoomListPage ownedRooms={SAMPLE_ROOMS} joinedRooms={SAMPLE_JOINED_ROOMS} />
}
