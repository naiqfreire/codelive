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
