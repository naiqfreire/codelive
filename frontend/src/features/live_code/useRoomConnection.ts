import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoomLanguage } from '../rooms'
import { logLiveEvent } from './log'
import {
  CODE_SEND_DEBOUNCE_MS,
  LATEST_VERSION_MESSAGE,
  MAX_CODE_BYTES,
  SYNC_NOTICE_DURATION_MS,
} from './messages'
import { codeUpdateFrame, joinFrame, parseRoomFrame } from './protocol'
import type { RoomRole } from './protocol'
import { buildRoomSocketUrl } from './socketUrl'

export type RoomConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export type RoomConnectionError = {
  code: string
  message: string
  requestId: string
}

/** Server content received while the local editor had unsent changes. */
export type RoomConflict = {
  serverContent: string
  receivedAt: string
}

export type RoomConnectionState = {
  status: RoomConnectionStatus
  code: string
  language: RoomLanguage | null
  participantCount: number
  role: RoomRole | null
  lastError: RoomConnectionError | null
  /** True after the first snapshot; the owner editor is locked before it. */
  hasSnapshot: boolean
  /** Local content exceeds the server's 256 KiB UTF-8 limit. */
  isOversize: boolean
  /** Snapshot that arrived while local edits were unsent. */
  conflict: RoomConflict | null
  /** Polite notice shown after a changed snapshot or an accepted server version. */
  syncNotice: string | null
}

export type RoomConnection = RoomConnectionState & {
  /** Called by the owner editor on every change; debounces the outgoing frame. */
  updateCode: (content: string) => void
  /** Applies a restored version without sending it back (the server already has it). */
  applyRestoredCode: (content: string) => void
  /** Conflict action: replace the local draft with the server snapshot. */
  acceptServerVersion: () => void
  /** Conflict action: keep the local draft and send it immediately. */
  keepLocalVersion: () => void
}

export type UseRoomConnectionOptions = {
  /** Last known code, kept while the socket is down (RNF04). */
  initialCode?: string
}

export const RECONNECT_BASE_DELAY_MS = 1000
export const RECONNECT_MAX_DELAY_MS = 8000
export const RECONNECT_JITTER_MS = 300
const SOCKET_OPEN = 1

/** Exponential backoff with jitter; retries never stop while the page is open. */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const exponential = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** attempt)
  return exponential + Math.floor(random() * RECONNECT_JITTER_MS)
}

/** UTF-8 byte length, matching the backend's `MAX_CODE_BYTES` measurement. */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function initialState(roomId: string | null, code: string): RoomConnectionState {
  return {
    status: roomId ? 'connecting' : 'idle',
    code,
    language: null,
    participantCount: 0,
    role: null,
    lastError: null,
    hasSnapshot: false,
    isOversize: utf8ByteLength(code) > MAX_CODE_BYTES,
    conflict: null,
    syncNotice: null,
  }
}

/**
 * Room live channel: joins, tracks presence, reconnects and syncs code.
 *
 * Receiving is safe for both roles. Sending is wired only by the owner page,
 * but the server is the authority on who may write. A reconnect snapshot never
 * silently overwrites unsent local edits: it becomes a `conflict` the owner
 * resolves explicitly (RNF02/RNF04).
 */
export function useRoomConnection(
  roomId: string | null,
  options: UseRoomConnectionOptions = {},
): RoomConnection {
  const initialCodeRef = useRef(options.initialCode ?? '')
  initialCodeRef.current = options.initialCode ?? ''

  const [state, setState] = useState<RoomConnectionState>(() =>
    initialState(roomId, initialCodeRef.current),
  )

  const socketRef = useRef<WebSocket | null>(null)
  const codeRef = useRef(initialCodeRef.current)
  const dirtyRef = useRef(false)
  const conflictRef = useRef<RoomConflict | null>(null)
  const hasSnapshotRef = useRef(false)
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRoomIdRef = useRef<string | null>(roomId)

  const clearSendTimer = useCallback(() => {
    if (sendTimerRef.current !== null) {
      clearTimeout(sendTimerRef.current)
      sendTimerRef.current = null
    }
  }, [])

  const clearNoticeTimer = useCallback(() => {
    if (noticeTimerRef.current !== null) {
      clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = null
    }
  }, [])

  const showSyncNotice = useCallback(() => {
    clearNoticeTimer()
    setState((previous) => ({ ...previous, syncNotice: LATEST_VERSION_MESSAGE }))
    noticeTimerRef.current = setTimeout(() => {
      noticeTimerRef.current = null
      setState((previous) => ({ ...previous, syncNotice: null }))
    }, SYNC_NOTICE_DURATION_MS)
  }, [clearNoticeTimer])

  const sendNow = useCallback(() => {
    clearSendTimer()

    if (!dirtyRef.current || conflictRef.current !== null) {
      return
    }

    const socket = socketRef.current
    if (!socket || socket.readyState !== SOCKET_OPEN) {
      return
    }

    const content = codeRef.current
    if (utf8ByteLength(content) > MAX_CODE_BYTES) {
      return
    }

    try {
      socket.send(JSON.stringify(codeUpdateFrame(content)))
      logLiveEvent('code_update_sent', {
        room_id: activeRoomIdRef.current,
        size_bytes: utf8ByteLength(content),
      })
    } catch {
      // The socket's onerror/onclose owns reconnection; the draft stays dirty.
    }
  }, [clearSendTimer])

  const scheduleSend = useCallback(
    (delay = CODE_SEND_DEBOUNCE_MS) => {
      if (conflictRef.current !== null) {
        return
      }

      clearSendTimer()
      sendTimerRef.current = setTimeout(() => {
        sendTimerRef.current = null
        sendNow()
      }, delay)
    },
    [clearSendTimer, sendNow],
  )

  const updateCode = useCallback(
    (content: string) => {
      codeRef.current = content
      dirtyRef.current = true
      const oversized = utf8ByteLength(content) > MAX_CODE_BYTES

      setState((previous) => ({
        ...previous,
        code: content,
        isOversize: oversized,
      }))

      if (oversized || conflictRef.current !== null) {
        clearSendTimer()
        return
      }

      scheduleSend()
    },
    [clearSendTimer, scheduleSend],
  )

  const applyRestoredCode = useCallback(
    (content: string) => {
      clearSendTimer()
      codeRef.current = content
      dirtyRef.current = false
      conflictRef.current = null

      setState((previous) => ({
        ...previous,
        code: content,
        isOversize: utf8ByteLength(content) > MAX_CODE_BYTES,
        conflict: null,
        lastError: null,
      }))
    },
    [clearSendTimer],
  )

  const acceptServerVersion = useCallback(() => {
    const conflict = conflictRef.current
    if (conflict === null) {
      return
    }

    clearSendTimer()
    codeRef.current = conflict.serverContent
    dirtyRef.current = false
    conflictRef.current = null

    setState((previous) => ({
      ...previous,
      code: conflict.serverContent,
      isOversize: utf8ByteLength(conflict.serverContent) > MAX_CODE_BYTES,
      conflict: null,
      lastError: null,
    }))
    showSyncNotice()
  }, [clearSendTimer, showSyncNotice])

  const keepLocalVersion = useCallback(() => {
    if (conflictRef.current === null) {
      return
    }

    conflictRef.current = null
    setState((previous) => ({ ...previous, conflict: null }))
    sendNow()
  }, [sendNow])

  useEffect(() => {
    const initialCode = initialCodeRef.current

    activeRoomIdRef.current = roomId
    socketRef.current = null
    codeRef.current = initialCode
    dirtyRef.current = false
    conflictRef.current = null
    hasSnapshotRef.current = false
    clearSendTimer()
    clearNoticeTimer()

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
      socketRef.current = nextSocket

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
          const firstSnapshot = !hasSnapshotRef.current
          const previousCode = codeRef.current
          hasSnapshotRef.current = true

          if (dirtyRef.current && previousCode !== frame.content) {
            clearSendTimer()
            const conflict: RoomConflict = {
              serverContent: frame.content,
              receivedAt: new Date().toISOString(),
            }
            conflictRef.current = conflict
            setState((previous) => ({
              ...previous,
              language: frame.language ?? previous.language,
              hasSnapshot: true,
              isOversize: utf8ByteLength(previousCode) > MAX_CODE_BYTES,
              conflict,
              lastError: null,
              syncNotice: null,
            }))
            return
          }

          dirtyRef.current = false
          conflictRef.current = null
          codeRef.current = frame.content

          setState((previous) => ({
            ...previous,
            code: frame.content,
            language: frame.language ?? previous.language,
            hasSnapshot: true,
            isOversize: utf8ByteLength(frame.content) > MAX_CODE_BYTES,
            conflict: null,
            lastError: null,
          }))

          if (!firstSnapshot && frame.content !== previousCode) {
            showSyncNotice()
          }
          return
        }

        if (frame.type === 'code_update') {
          if (frame.content === codeRef.current) {
            // Our own echo (or an identical update): the server is in sync.
            dirtyRef.current = false
            setState((previous) => ({
              ...previous,
              code: frame.content,
              lastError: null,
            }))
            return
          }

          if (!dirtyRef.current) {
            codeRef.current = frame.content
            setState((previous) => ({
              ...previous,
              code: frame.content,
              isOversize: utf8ByteLength(frame.content) > MAX_CODE_BYTES,
              lastError: null,
            }))
          }
          // A stale echo while newer local edits are pending is ignored.
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
        socketRef.current = null
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

      clearSendTimer()
      clearNoticeTimer()
      socketRef.current = null
      socket?.close()
      socket = null
    }
  }, [roomId, clearNoticeTimer, clearSendTimer, showSyncNotice])

  return {
    ...state,
    updateCode,
    applyRestoredCode,
    acceptServerVersion,
    keepLocalVersion,
  }
}
