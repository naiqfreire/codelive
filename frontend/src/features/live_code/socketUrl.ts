type BuildRoomSocketUrlInput = {
  origin: string
  roomId: string
}

/**
 * Same path the backend mounts: `/api` + `/ws` + `/rooms/{room_id}`.
 * Uses the current origin so the httpOnly session cookie travels with the
 * handshake; `http` becomes `ws` and `https` becomes `wss`.
 */
export function buildRoomSocketUrl({ origin, roomId }: BuildRoomSocketUrlInput): string {
  const url = new URL(`/api/ws/rooms/${encodeURIComponent(roomId)}`, origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
