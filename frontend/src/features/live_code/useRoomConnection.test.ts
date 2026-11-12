import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
        code: 'print(1)',
        language: 'python',
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
    })
    expect(typeof lastLog().timestamp).toBe('string')
  })

  it('applies a code_update frame', () => {
    const { result } = renderHook(() => useRoomConnection('room-1'))

    act(() => {
      latestSocket().open()
      latestSocket().receive({ type: 'code_update', code: 'novo', request_id: 'req-3' })
    })

    expect(result.current.code).toBe('novo')
  })

  it('surfaces an error frame without dropping the code', () => {
    const { result } = renderHook(() => useRoomConnection('room-1'))

    act(() => {
      latestSocket().open()
      latestSocket().receive({ type: 'code_update', code: 'mantido', request_id: 'req-3' })
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
      first.receive({ type: 'code_update', code: 'preservado', request_id: 'req-5' })
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
