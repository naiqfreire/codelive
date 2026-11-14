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

/**
 * Room resolved from an access code (`GET /api/rooms/by-code/{codigo}`).
 * It carries metadata for the identification step, not the live code content.
 */
export type RoomLookup = RoomSummary & {
  ownerId: string
  updatedAt: string
}
