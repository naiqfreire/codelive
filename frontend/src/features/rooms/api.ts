/**
 * Service layer for the rooms slice: every HTTP call of this feature lives here.
 * Components and hooks never call `fetch` directly.
 */
import { apiRequest } from '../../shared/http'
import type { RoomLanguage } from './languages'
import type { JoinedRoom, RoomStatus, RoomSummary } from './types'

type RoomResponse = {
  id: string
  access_code: string
  language: RoomLanguage
  status: RoomStatus
  created_at: string
}

type JoinedRoomResponse = RoomResponse & { joined_at: string }

type JoinedRoomsResponse = { items: JoinedRoomResponse[] }

export type RoomsApi = {
  listMine(): Promise<RoomSummary[]>
  listJoined(): Promise<JoinedRoom[]>
  create(language: RoomLanguage): Promise<RoomSummary>
  close(roomId: string): Promise<RoomSummary>
  regenerateCode(roomId: string): Promise<RoomSummary>
}

/** Mirrors the backend `RoomOut` payload into the feature camelCase contract. */
export function toRoomSummary(room: RoomResponse): RoomSummary {
  return {
    id: room.id,
    accessCode: room.access_code,
    language: room.language,
    status: room.status,
    createdAt: room.created_at,
  }
}

/** Mirrors the backend `JoinedRoomOut` payload into the feature camelCase contract. */
export function toJoinedRoom(room: JoinedRoomResponse): JoinedRoom {
  return { ...toRoomSummary(room), joinedAt: room.joined_at }
}

export const roomsApi: RoomsApi = {
  async listMine() {
    const rooms = await apiRequest<RoomResponse[]>('/api/rooms/mine')
    return rooms.map(toRoomSummary)
  },

  async listJoined() {
    const payload = await apiRequest<JoinedRoomsResponse>('/api/rooms/joined')
    return payload.items.map(toJoinedRoom)
  },

  async create(language) {
    const room = await apiRequest<RoomResponse>('/api/rooms', {
      method: 'POST',
      body: { language },
    })
    return toRoomSummary(room)
  },

  async close(roomId) {
    const room = await apiRequest<RoomResponse>(
      `/api/rooms/${encodeURIComponent(roomId)}/close`,
      { method: 'PATCH' },
    )
    return toRoomSummary(room)
  },

  async regenerateCode(roomId) {
    const room = await apiRequest<RoomResponse>(
      `/api/rooms/${encodeURIComponent(roomId)}/regenerate-code`,
      { method: 'POST' },
    )
    return toRoomSummary(room)
  },
}
