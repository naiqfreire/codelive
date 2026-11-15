import type { RoomLanguage } from './languages'

export type RoomStatus = 'active' | 'closed'

/** Mirrors the backend `RoomOut` payload in camelCase. */
export type RoomSummary = {
  id: string
  accessCode: string
  language: RoomLanguage
  status: RoomStatus
  createdAt: string
}

export type RoomDetail = RoomSummary & { code: string }

/** Mirrors the backend `JoinedRoomOut` payload: a room the user joined as a spectator. */
export type JoinedRoom = RoomSummary & { joinedAt: string }

/** A room rendered in either list tab; `joinedAt` is only present on the joined tab. */
export type RoomListItem = RoomSummary & { joinedAt?: string }
