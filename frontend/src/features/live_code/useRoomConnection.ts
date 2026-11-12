import { useEffect, useRef, useState } from 'react'
import type { RoomLanguage } from '../rooms'
import { logLiveEvent } from './log'
import { joinFrame, parseRoomFrame } from './protocol'
import type { RoomRole } from './protocol'
import { buildRoomSocketUrl } from './socketUrl'

export type RoomConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export type RoomConnectionError = {
  code: string
  message: string
  requestId: string
}

export type RoomConnectionState = {
  status: RoomConnectionStatus
  code: string
  language: RoomLanguage | null
  participantCount: number
  role: RoomRole | null
  lastError: RoomConnectionError | null
}

export type UseRoomConnectionOptions = {
  /** Last known code, kept while the socket is down (RNF04). */
  initialCode?: string
}

export const RECONNECT_BASE_DELAY_MS = 1000
export const RECONNECT_MAX_DELAY_MS = 8000
export const RECONNECT_JITTER_MS = 300

/** Exponential backoff with jitter; retries never stop while the page is open. */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const exponential = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** attempt)
  return exponential + Math.floor(random() * RECONNECT_JITTER_MS)
}

function initialState(roomId: string | null, code: string): RoomConnectionState {
  return {
    status: roomId ? 'connecting' : 'idle',
    code,
    language: null,
    participantCount: 0,
    role: null,
    lastError: null,
  }
}

/**
 * Room live channel: joins, tracks presence and reconnects on its own.
 *
 * The last received code is preserved across drops and the next `snapshot`
 * replaces it without resetting the editor, so a reconnecting spectator never
 * loses state (RNF02/RNF04).
 */
export function useRoomConnection(
  roomId: string | null,
  options: UseRoomConnectionOptions = {},
): RoomConnectionState {
  const initialCodeRef = useRef(options.initialCode ?? '')
  initialCodeRef.current = options.initialCode ?? ''

  const [state, setState] = useState<RoomConnectionState>(() =>
    initialState(roomId, initialCodeRef.current),
  )

  useEffect(() => {
    const initialCode = initialCodeRef.current

    if (!roomId) {
      setState(initialState(null, initialCode))
      return
    }

    const activeRoomId = roomId

    let disposed = false
    let socket: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let hasConnected = false

    setState(initialState(activeRoomId, initialCode))

    function scheduleReconnect() {
      if (disposed) {
        return
      }

      const delay = reconnectDelay(attempt)
      attempt += 1
      logLiveEvent('reconnect_scheduled', { room_id: activeRoomId, attempt, delay_ms: delay })

      setState((previous) => ({
        ...previous,
        status: hasConnected ? 'reconnecting' : 'disconnected',
      }))

      retryTimer = setTimeout(() => {
        retryTimer = null
        connect()
      }, delay)
    }

    function connect() {
      if (disposed) {
        return
      }

      let nextSocket: WebSocket

      try {
        nextSocket = new WebSocket(
          buildRoomSocketUrl({ origin: window.location.origin, roomId: activeRoomId }),
        )
      } catch {
        logLiveEvent('socket_error', { room_id: activeRoomId, reason: 'construct_failed' })
        scheduleReconnect()
        return
      }

      socket = nextSocket

      nextSocket.onopen = () => {
        if (disposed) {
          return
        }

        hasConnected = true
        attempt = 0
        logLiveEvent('socket_open', { room_id: activeRoomId })
        setState((previous) => ({ ...previous, status: 'connected', lastError: null }))
        nextSocket.send(JSON.stringify(joinFrame()))
        logLiveEvent('join_sent', { room_id: activeRoomId })
      }

      nextSocket.onmessage = (event: MessageEvent) => {
        if (disposed) {
          return
        }

        const frame = parseRoomFrame(event.data)

        if (!frame) {
          logLiveEvent('frame_ignored', { room_id: activeRoomId })
          return
        }

        logLiveEvent('frame_received', {
          room_id: activeRoomId,
          frame_type: frame.type,
          request_id: frame.requestId,
          ...(frame.type === 'snapshot' || frame.type === 'code_update'
            ? { content_hash: frame.contentHash }
            : {}),
        })

        if (frame.type === 'presence') {
          setState((previous) => ({
            ...previous,
            participantCount: frame.count,
            role: frame.role,
          }))
          return
        }

        if (frame.type === 'error') {
          setState((previous) => ({
            ...previous,
            lastError: {
              code: frame.code,
              message: frame.message,
              requestId: frame.requestId,
            },
          }))
          return
        }

        if (frame.type === 'snapshot') {
          setState((previous) => ({
            ...previous,
            code: frame.content,
            language: frame.language ?? previous.language,
            lastError: null,
          }))
          return
        }

        if (frame.type === 'code_update') {
          setState((previous) => ({
            ...previous,
            code: frame.content,
            lastError: null,
          }))
        }
      }

      nextSocket.onerror = () => {
        logLiveEvent('socket_error', { room_id: activeRoomId })
      }

      nextSocket.onclose = () => {
        if (disposed) {
          return
        }

        socket = null
        logLiveEvent('socket_closed', { room_id: activeRoomId, had_connected: hasConnected })
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      disposed = true

      if (retryTimer !== null) {
        clearTimeout(retryTimer)
        retryTimer = null
      }

      socket?.close()
      socket = null
    }
  }, [roomId])

  return state
}
