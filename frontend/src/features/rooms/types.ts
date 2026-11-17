import { LANGUAGES } from './languages'
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
 * Runtime guard for room metadata carried through navigation state.
 *
 * The state is only a rendering hint: the backend still authorizes the live
 * channel, so an unknown or forged room never grants access to the code.
 */
export function isRoomSummary(value: unknown): value is RoomSummary {
  if (!value || typeof value !== 'object') return false

  const room = value as Record<string, unknown>

  return (
    typeof room.id === 'string' &&
    typeof room.accessCode === 'string' &&
    typeof room.language === 'string' &&
    (LANGUAGES as readonly string[]).includes(room.language) &&
    (room.status === 'active' || room.status === 'closed') &&
    typeof room.createdAt === 'string'
  )
}

/**
 * Room the authenticated user entered as a spectator (RF04), from
 * `GET /api/rooms/joined`. Carries the room's current identity plus the date
 * the membership was created.
 */
export type JoinedRoom = RoomSummary & {
  joinedAt: string
}

/**
 * Room resolved from an access code (`GET /api/rooms/by-code/{codigo}`).
 * It carries metadata for the identification step, not the live code content.
 */
export type RoomLookup = RoomSummary & {
  ownerId: string
  updatedAt: string
}
