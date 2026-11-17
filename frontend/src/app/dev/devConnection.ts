import { useEffect, useState } from 'react'
import type { RoomConnection, RoomRole } from '../../features/live_code'
import { LATEST_VERSION_MESSAGE } from '../../features/live_code'
import type { RoomDetail } from '../../features/rooms'
import { SAMPLE_PARTICIPANTS } from './sampleRooms'

/**
 * In-memory live channel for the DEV fixtures.
 *
 * The real pages are wired to `useRoomConnection`, but the fixture has no
 * backend session. This stand-in keeps the editor editable (owner) or read-only
 * (spectator) and lets the restore flow be reviewed without a socket.
 */
export function useDevRoomConnection(
  room: RoomDetail | undefined,
  role: RoomRole = 'owner',
): RoomConnection {
  const [code, setCode] = useState(room?.code ?? '')
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setCode(room?.code ?? '')
    setNotice(null)
    // The fixture room object is stable; this only runs when the id changes.
  }, [room])

  return {
    status: room ? 'connected' : 'idle',
    code,
    language: room?.language ?? null,
    participantCount: room ? SAMPLE_PARTICIPANTS.length : 0,
    role,
    lastError: null,
    hasSnapshot: Boolean(room),
    isOversize: false,
    conflict: null,
    syncNotice: notice,
    updateCode: setCode,
    applyRestoredCode: setCode,
    acceptServerVersion: () => setNotice(LATEST_VERSION_MESSAGE),
    keepLocalVersion: () => undefined,
  }
}
