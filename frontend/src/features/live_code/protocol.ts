import type { RoomLanguage } from '../rooms'
import { LANGUAGES } from '../rooms'

/**
 * Mirror of the backend wire protocol (`backend/app/features/live_code/protocol.py`).
 *
 * The backend currently broadcasts `presence` and `error`. The `snapshot` and
 * `code_update` shapes are still owned by the real-time broadcast slice, so the
 * parser is deliberately defensive: it accepts `code` as a string and treats
 * everything else as optional. Invalid frames never throw — they become `null`
 * and the caller decides how to log them.
 */
export type RoomRole = 'owner' | 'viewer'

export type JoinFrame = { type: 'join' }

export type PresenceFrame = {
  type: 'presence'
  roomId: string
  count: number
  role: RoomRole
  requestId: string
}

export type SnapshotFrame = {
  type: 'snapshot'
  code: string
  language: RoomLanguage | null
  requestId: string
}

export type CodeUpdateFrame = {
  type: 'code_update'
  code: string
  language: RoomLanguage | null
  requestId: string
}

export type ErrorFrame = {
  type: 'error'
  code: string
  message: string
  requestId: string
}

export type ServerFrame = PresenceFrame | SnapshotFrame | CodeUpdateFrame | ErrorFrame

export function joinFrame(): JoinFrame {
  return { type: 'join' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parsePayload(raw: unknown): unknown {
  if (typeof raw !== 'string') {
    return raw
  }

  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === 'string' ? value : null
}

function readLanguage(value: unknown): RoomLanguage | null {
  if (typeof value !== 'string') {
    return null
  }

  return (LANGUAGES as readonly string[]).includes(value) ? (value as RoomLanguage) : null
}

function readRole(value: unknown): RoomRole | null {
  return value === 'owner' || value === 'viewer' ? value : null
}

function parsePresence(payload: Record<string, unknown>): PresenceFrame | null {
  const roomId = readString(payload, 'room_id')
  const count = payload.count
  const role = readRole(payload.role)

  if (
    roomId === null ||
    role === null ||
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < 0
  ) {
    return null
  }

  return {
    type: 'presence',
    roomId,
    count,
    role,
    requestId: readString(payload, 'request_id') ?? '',
  }
}

function parseCodeFrame(
  type: 'snapshot' | 'code_update',
  payload: Record<string, unknown>,
): SnapshotFrame | CodeUpdateFrame | null {
  const code = readString(payload, 'code')

  if (code === null) {
    return null
  }

  return {
    type,
    code,
    language: readLanguage(payload.language),
    requestId: readString(payload, 'request_id') ?? '',
  }
}

function parseError(payload: Record<string, unknown>): ErrorFrame | null {
  const error = payload.error

  if (!isRecord(error)) {
    return null
  }

  const code = readString(error, 'code')
  const message = readString(error, 'message')

  if (code === null || message === null) {
    return null
  }

  return {
    type: 'error',
    code,
    message,
    requestId: readString(error, 'request_id') ?? '',
  }
}

export function parseRoomFrame(raw: unknown): ServerFrame | null {
  const payload = parsePayload(raw)

  if (!isRecord(payload)) {
    return null
  }

  if ('error' in payload) {
    return parseError(payload)
  }

  switch (payload.type) {
    case 'presence':
      return parsePresence(payload)
    case 'snapshot':
    case 'code_update':
      return parseCodeFrame(payload.type, payload)
    default:
      return null
  }
}
