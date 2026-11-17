import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LATEST_VERSION_MESSAGE,
  MAX_CODE_BYTES,
  SYNC_NOTICE_DURATION_MS,
} from './messages'
import { reconnectDelay, useRoomConnection } from './useRoomConnection'

type Handler = ((event: Event) => void) | null

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  url: string
  readyState = 0
  sent: string[] = []
  closed = false
  onopen: Handler = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: Handler = null
  onerror: Handler = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    if (this.closed) {
      return
    }

    this.closed = true
    this.readyState = 3
    this.onclose?.(new Event('close'))
  }

  open() {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }

  receive(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)
  }

  drop() {
    this.readyState = 3
    this.onclose?.(new Event('close'))
  }
}

function latestSocket(): FakeWebSocket {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
}

function lastLog(): Record<string, unknown> {
  const info = vi.mocked(console.info)
  return info.mock.calls[info.mock.calls.length - 1]?.[1] as Record<string, unknown>
}

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('reconnectDelay', () => {
  it('backs off exponentially and stops at the ceiling', () => {
    expect(reconnectDelay(0, () => 0)).toBe(1000)
    expect(reconnectDelay(1, () => 0)).toBe(2000)
    expect(reconnectDelay(2, () => 0)).toBe(4000)
    expect(reconnectDelay(3, () => 0)).toBe(8000)
    expect(reconnectDelay(10, () => 0)).toBe(8000)
  })

  it('adds a jitter of up to 300 ms', () => {
    expect(reconnectDelay(0, () => 0.5)).toBe(1150)
  })
})

describe('useRoomConnection', () => {
  it('stays idle without a room', () => {
    const { result } = renderHook(() => useRoomConnection(null))

    expect(result.current.status).toBe('idle')
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('opens the room socket and sends join once connected', () => {
    const { result } = renderHook(() => useRoomConnection('room-1'))

    expect(result.current.status).toBe('connecting')

    const socket = latestSocket()
    expect(socket.url).toBe(`${window.location.origin.replace(/^http/, 'ws')}/api/ws/rooms/room-1`)

    act(() => socket.open())

    expect(result.current.status).toBe('connected')
    expect(socket.sent).toEqual([JSON.stringify({ type: 'join' })])
  })

  it('updates the participant count and role from presence', () => {
    const { result } = renderHook(() => useRoomConnection('room-1'))

    act(() => {
      latestSocket().open()
      latestSocket().receive({
        type: 'presence',
        room_id: 'room-1',
        count: 4,
        role: 'viewer',
        request_id: 'req-1',
      })
    })

    expect(result.current.participantCount).toBe(4)
    expect(result.current.role).toBe('viewer')
  })

  it('applies a snapshot and logs it with timestamp and request_id', () => {
    const { result } = renderHook(() => useRoomConnection('room-1'))

    act(() => {
      latestSocket().open()
      latestSocket().receive({
        type: 'snapshot',
        room_id: 'room-1',
        content: 'print(1)',
        language: 'python',
        content_hash: 'sha256:abc',
        request_id: 'req-2',
      })
    })

    expect(result.current.code).toBe('print(1)')
    expect(result.current.language).toBe('python')
    expect(lastLog()).toMatchObject({
      event: 'frame_received',
      frame_type: 'snapshot',
      request_id: 'req-2',
      room_id: 'room-1',
      content_hash: 'sha256:abc',
    })
    expect(typeof lastLog().timestamp).toBe('string')
  })

  it('applies a code_update frame and keeps the snapshot language', () => {
    const { result } = renderHook(() => useRoomConnection('room-1'))

    act(() => {
      latestSocket().open()
      latestSocket().receive({
        type: 'snapshot',
        content: '',
        language: 'python',
        content_hash: 'sha256:a',
        request_id: 'req-2',
      })
      latestSocket().receive({
        type: 'code_update',
        content: 'novo',
        content_hash: 'sha256:b',
        request_id: 'req-3',
      })
    })

    expect(result.current.code).toBe('novo')
    expect(result.current.language).toBe('python')
    expect(lastLog()).toMatchObject({
      frame_type: 'code_update',
      request_id: 'req-3',
      content_hash: 'sha256:b',
    })
  })

  it('surfaces an error frame without dropping the code', () => {
    const { result } = renderHook(() => useRoomConnection('room-1'))

    act(() => {
      latestSocket().open()
      latestSocket().receive({
        type: 'code_update',
        content: 'mantido',
        content_hash: 'sha256:c',
        request_id: 'req-3',
      })
      latestSocket().receive({
        error: { code: 'validation_error', message: 'Dados inválidos.', request_id: 'req-4' },
      })
    })

    expect(result.current.status).toBe('connected')
    expect(result.current.code).toBe('mantido')
    expect(result.current.lastError).toEqual({
      code: 'validation_error',
      message: 'Dados inválidos.',
      requestId: 'req-4',
    })
  })

  it('ignores and logs invalid frames', () => {
    const { result } = renderHook(() => useRoomConnection('room-1'))

    act(() => {
      latestSocket().open()
      latestSocket().receive({ type: 'ping' })
    })

    expect(result.current.code).toBe('')
    expect(lastLog()).toMatchObject({ event: 'frame_ignored', room_id: 'room-1' })
  })

  it('keeps the code and reconnects after a drop', () => {
    const { result } = renderHook(() => useRoomConnection('room-1'))
    const first = latestSocket()

    act(() => {
      first.open()
      first.receive({
        type: 'code_update',
        content: 'preservado',
        content_hash: 'sha256:d',
        request_id: 'req-5',
      })
      first.drop()
    })

    expect(result.current.status).toBe('reconnecting')
    expect(result.current.code).toBe('preservado')
    expect(FakeWebSocket.instances).toHaveLength(1)

    act(() => vi.advanceTimersByTime(999))
    expect(FakeWebSocket.instances).toHaveLength(1)

    act(() => vi.advanceTimersByTime(1))
    expect(FakeWebSocket.instances).toHaveLength(2)

    const second = latestSocket()
    expect(second.url).toBe(first.url)

    act(() => second.open())

    expect(result.current.status).toBe('connected')
    expect(second.sent).toEqual([JSON.stringify({ type: 'join' })])
    expect(result.current.code).toBe('preservado')
  })

  it('reports disconnected when the first attempt fails', () => {
    const { result } = renderHook(() => useRoomConnection('room-1'))

    act(() => latestSocket().drop())

    expect(result.current.status).toBe('disconnected')
  })

  it('backs off across consecutive failed attempts', () => {
    renderHook(() => useRoomConnection('room-1'))

    act(() => latestSocket().drop())
    act(() => vi.advanceTimersByTime(1000))
    expect(FakeWebSocket.instances).toHaveLength(2)

    act(() => latestSocket().drop())
    act(() => vi.advanceTimersByTime(1999))
    expect(FakeWebSocket.instances).toHaveLength(2)

    act(() => vi.advanceTimersByTime(1))
    expect(FakeWebSocket.instances).toHaveLength(3)
  })

  it('closes the socket and stops reconnecting on unmount', () => {
    const { unmount } = renderHook(() => useRoomConnection('room-1'))
    const socket = latestSocket()

    unmount()

    expect(socket.closed).toBe(true)

    act(() => vi.advanceTimersByTime(60_000))
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('cancels a pending reconnect on unmount', () => {
    const { unmount } = renderHook(() => useRoomConnection('room-1'))

    act(() => latestSocket().drop())
    unmount()

    act(() => vi.advanceTimersByTime(60_000))
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('opens a new socket when the room changes', () => {
    const { rerender } = renderHook(({ roomId }) => useRoomConnection(roomId), {
      initialProps: { roomId: 'room-1' },
    })
    const first = latestSocket()

    rerender({ roomId: 'room-2' })

    expect(first.closed).toBe(true)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(latestSocket().url).toContain('/api/ws/rooms/room-2')
  })
})

describe('useRoomConnection code recovery and sending', () => {
  function openWithSnapshot(content: string, roomId = 'room-1') {
    const hook = renderHook(() => useRoomConnection(roomId))

    act(() => {
      latestSocket().open()
      latestSocket().receive({
        type: 'snapshot',
        room_id: roomId,
        content,
        language: 'python',
        content_hash: 'sha256:server',
        request_id: 'req-snapshot',
      })
    })

    return hook
  }

  it('loads the persisted code from the first snapshot and marks it loaded', () => {
    const { result } = openWithSnapshot('persistido')

    expect(result.current.code).toBe('persistido')
    expect(result.current.hasSnapshot).toBe(true)
    expect(result.current.conflict).toBeNull()
    expect(result.current.syncNotice).toBeNull()
  })

  it('sends the owner edit after the debounce window', () => {
    const { result } = openWithSnapshot('')
    const socket = latestSocket()

    act(() => result.current.updateCode("print('oi')"))

    expect(result.current.code).toBe("print('oi')")

    act(() => vi.advanceTimersByTime(299))
    expect(socket.sent).toEqual([JSON.stringify({ type: 'join' })])

    act(() => vi.advanceTimersByTime(1))
    expect(socket.sent).toEqual([
      JSON.stringify({ type: 'join' }),
      JSON.stringify({ type: 'code_update', content: "print('oi')" }),
    ])
  })

  it('coalesces rapid edits into the latest content', () => {
    const { result } = openWithSnapshot('')
    const socket = latestSocket()

    act(() => result.current.updateCode('a'))
    act(() => vi.advanceTimersByTime(150))
    act(() => result.current.updateCode('ab'))
    act(() => vi.advanceTimersByTime(299))

    expect(socket.sent).toHaveLength(1)

    act(() => vi.advanceTimersByTime(1))
    expect(socket.sent[1]).toBe(JSON.stringify({ type: 'code_update', content: 'ab' }))
  })

  it('does not send while the socket is down and keeps the local draft', () => {
    const { result } = openWithSnapshot('')
    const first = latestSocket()

    act(() => {
      first.drop()
      result.current.updateCode('rascunho offline')
    })
    act(() => vi.advanceTimersByTime(300))

    expect(first.sent).toHaveLength(1)

    act(() => vi.advanceTimersByTime(700))
    const second = latestSocket()
    expect(second).not.toBe(first)

    act(() => second.open())
    expect(second.sent).toEqual([JSON.stringify({ type: 'join' })])
    expect(result.current.code).toBe('rascunho offline')
  })

  it('applies a changed snapshot after reconnect and shows the latest version notice', () => {
    const { result } = openWithSnapshot('v1')

    act(() => latestSocket().drop())
    act(() => vi.advanceTimersByTime(1000))

    act(() => {
      latestSocket().open()
      latestSocket().receive({
        type: 'snapshot',
        room_id: 'room-1',
        content: 'v2',
        language: 'python',
        content_hash: 'sha256:v2',
        request_id: 'req-reconnect',
      })
    })

    expect(result.current.code).toBe('v2')
    expect(result.current.conflict).toBeNull()
    expect(result.current.syncNotice).toBe(LATEST_VERSION_MESSAGE)

    act(() => vi.advanceTimersByTime(SYNC_NOTICE_DURATION_MS))
    expect(result.current.syncNotice).toBeNull()
  })

  it('keeps local edits when reconnecting with a diverged snapshot', () => {
    const { result } = openWithSnapshot('server-v1')

    act(() => {
      latestSocket().drop()
      result.current.updateCode('local-draft')
    })

    act(() => vi.advanceTimersByTime(1000))
    const second = latestSocket()

    act(() => {
      second.open()
      second.receive({
        type: 'snapshot',
        room_id: 'room-1',
        content: 'server-v2',
        language: 'python',
        content_hash: 'sha256:server-v2',
        request_id: 'req-reconnect',
      })
    })

    expect(result.current.code).toBe('local-draft')
    expect(result.current.conflict).toEqual({
      serverContent: 'server-v2',
      receivedAt: expect.any(String),
    })
    expect(result.current.syncNotice).toBeNull()

    act(() => vi.advanceTimersByTime(300))
    expect(second.sent).toEqual([JSON.stringify({ type: 'join' })])
  })

  it('accepts the server version and clears the conflict', () => {
    const { result } = openWithSnapshot('server-v1')

    act(() => {
      latestSocket().drop()
      result.current.updateCode('local-draft')
    })
    act(() => vi.advanceTimersByTime(1000))
    act(() => {
      latestSocket().open()
      latestSocket().receive({
        type: 'snapshot',
        room_id: 'room-1',
        content: 'server-v2',
        language: 'python',
        content_hash: 'sha256:server-v2',
        request_id: 'req-reconnect',
      })
    })

    act(() => result.current.acceptServerVersion())

    expect(result.current.code).toBe('server-v2')
    expect(result.current.conflict).toBeNull()
    expect(result.current.syncNotice).toBe(LATEST_VERSION_MESSAGE)
  })

  it('keeps the local version and resends it immediately', () => {
    const { result } = openWithSnapshot('server-v1')

    act(() => {
      latestSocket().drop()
      result.current.updateCode('local-draft')
    })
    act(() => vi.advanceTimersByTime(1000))
    const second = latestSocket()
    act(() => {
      second.open()
      second.receive({
        type: 'snapshot',
        room_id: 'room-1',
        content: 'server-v2',
        language: 'python',
        content_hash: 'sha256:server-v2',
        request_id: 'req-reconnect',
      })
    })

    act(() => result.current.keepLocalVersion())

    expect(result.current.code).toBe('local-draft')
    expect(result.current.conflict).toBeNull()
    expect(second.sent).toEqual([
      JSON.stringify({ type: 'join' }),
      JSON.stringify({ type: 'code_update', content: 'local-draft' }),
    ])
  })

  it('confirms the local edit when the server echoes it', () => {
    const { result } = openWithSnapshot('')
    const first = latestSocket()

    act(() => result.current.updateCode('sincronizado'))
    act(() => vi.advanceTimersByTime(300))
    act(() => {
      first.receive({
        type: 'code_update',
        content: 'sincronizado',
        content_hash: 'sha256:sync',
        request_id: 'req-echo',
      })
      first.drop()
    })

    act(() => vi.advanceTimersByTime(1000))
    act(() => {
      latestSocket().open()
      latestSocket().receive({
        type: 'snapshot',
        room_id: 'room-1',
        content: 'outra-versao',
        language: 'python',
        content_hash: 'sha256:other',
        request_id: 'req-reconnect',
      })
    })

    expect(result.current.conflict).toBeNull()
    expect(result.current.code).toBe('outra-versao')
    expect(result.current.syncNotice).toBe(LATEST_VERSION_MESSAGE)
  })

  it('ignores an older echo while a newer local edit is pending', () => {
    const { result } = openWithSnapshot('')
    const socket = latestSocket()

    act(() => result.current.updateCode('primeiro'))
    act(() => vi.advanceTimersByTime(300))
    act(() => result.current.updateCode('segundo'))
    act(() => {
      socket.receive({
        type: 'code_update',
        content: 'primeiro',
        content_hash: 'sha256:first',
        request_id: 'req-echo',
      })
    })

    expect(result.current.code).toBe('segundo')

    act(() => vi.advanceTimersByTime(300))
    expect(socket.sent[2]).toBe(JSON.stringify({ type: 'code_update', content: 'segundo' }))
  })

  it('blocks oversized content and resumes when it fits', () => {
    const { result } = openWithSnapshot('')
    const socket = latestSocket()

    act(() => result.current.updateCode('a'.repeat(MAX_CODE_BYTES + 1)))
    act(() => vi.advanceTimersByTime(300))

    expect(result.current.isOversize).toBe(true)
    expect(socket.sent).toHaveLength(1)

    act(() => result.current.updateCode('ok'))
    act(() => vi.advanceTimersByTime(300))

    expect(result.current.isOversize).toBe(false)
    expect(socket.sent[1]).toBe(JSON.stringify({ type: 'code_update', content: 'ok' }))
  })

  it('measures the size limit on UTF-8 bytes', () => {
    const { result } = openWithSnapshot('')
    const socket = latestSocket()

    act(() => result.current.updateCode('á'.repeat(MAX_CODE_BYTES / 2 + 1)))
    expect(result.current.isOversize).toBe(true)

    act(() => result.current.updateCode('á'.repeat(MAX_CODE_BYTES / 2)))
    act(() => vi.advanceTimersByTime(300))

    expect(result.current.isOversize).toBe(false)
    expect(socket.sent[1]).toBe(
      JSON.stringify({ type: 'code_update', content: 'á'.repeat(MAX_CODE_BYTES / 2) }),
    )
  })

  it('applies restored content without sending it back', () => {
    const { result } = openWithSnapshot('antigo')
    const socket = latestSocket()

    act(() => result.current.applyRestoredCode('restaurado'))

    expect(result.current.code).toBe('restaurado')
    expect(result.current.syncNotice).toBeNull()

    act(() => vi.advanceTimersByTime(300))
    expect(socket.sent).toEqual([JSON.stringify({ type: 'join' })])
  })
})
