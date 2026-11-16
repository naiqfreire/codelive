/**
 * Service layer for the rooms slice: every HTTP call of this feature lives here.
 * Components and hooks never call `fetch` directly.
 */
import { apiRequest } from '../../shared/http'
import type { RoomLanguage } from './languages'
import type { JoinedRoom, RoomLookup, RoomStatus, RoomSummary } from './types'

type RoomResponse = {
  id: string
  access_code: string
  language: RoomLanguage
  status: RoomStatus
  created_at: string
}

type ByCodeResponse = RoomResponse & {
  owner_id: string
  updated_at: string
}

type JoinedRoomResponse = RoomResponse & {
  room_id: string
  user_id: string
  role: 'owner' | 'viewer'
  is_anonymous: boolean
  nickname: string | null
  joined_at: string
}

type JoinedRoomsResponse = {
  items: JoinedRoomResponse[]
}

export type RoomsApi = {
  listMine(): Promise<RoomSummary[]>
  listJoined(): Promise<JoinedRoom[]>
  create(language: RoomLanguage): Promise<RoomSummary>
  close(roomId: string): Promise<RoomSummary>
  regenerateCode(roomId: string): Promise<RoomSummary>
  getByCode(code: string): Promise<RoomLookup>
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

/** Mirrors the backend `ByCodeResponse` payload into the feature contract. */
export function toRoomLookup(room: ByCodeResponse): RoomLookup {
  return {
    ...toRoomSummary(room),
    ownerId: room.owner_id,
    updatedAt: room.updated_at,
  }
}

/** Mirrors one `GET /api/rooms/joined` item into the feature contract. */
export function toJoinedRoom(item: JoinedRoomResponse): JoinedRoom {
  return {
    id: item.room_id,
    accessCode: item.access_code,
    language: item.language,
    status: item.status,
    createdAt: item.created_at,
    joinedAt: item.joined_at,
  }
}

export const roomsApi: RoomsApi = {
  async listMine() {
    const rooms = await apiRequest<RoomResponse[]>('/api/rooms/mine')
    return rooms.map(toRoomSummary)
  },

  async listJoined() {
    const response = await apiRequest<JoinedRoomsResponse>('/api/rooms/joined')
    return response.items.map(toJoinedRoom)
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

  async getByCode(code) {
    const room = await apiRequest<ByCodeResponse>(
      `/api/rooms/by-code/${encodeURIComponent(code)}`,
      { logPath: '/api/rooms/by-code/{codigo}' },
    )
    return toRoomLookup(room)
  },
}
