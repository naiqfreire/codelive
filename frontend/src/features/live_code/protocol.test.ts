import { describe, expect, it } from 'vitest'
import { joinFrame, parseRoomFrame } from './protocol'

describe('joinFrame', () => {
  it('builds the client join frame', () => {
    expect(joinFrame()).toEqual({ type: 'join' })
  })
})

describe('parseRoomFrame', () => {
  it('parses a presence frame from JSON text', () => {
    const frame = parseRoomFrame(
      JSON.stringify({
        type: 'presence',
        room_id: 'room-1',
        count: 3,
        role: 'viewer',
        request_id: 'req-1',
      }),
    )

    expect(frame).toEqual({
      type: 'presence',
      roomId: 'room-1',
      count: 3,
      role: 'viewer',
      requestId: 'req-1',
    })
  })

  it('parses a snapshot frame with a supported language', () => {
    const frame = parseRoomFrame({
      type: 'snapshot',
      code: 'print(1)',
      language: 'python',
      request_id: 'req-2',
    })

    expect(frame).toEqual({
      type: 'snapshot',
      code: 'print(1)',
      language: 'python',
      requestId: 'req-2',
    })
  })

  it('parses a code_update frame without a language', () => {
    const frame = parseRoomFrame({ type: 'code_update', code: 'x', request_id: 'req-3' })

    expect(frame).toEqual({
      type: 'code_update',
      code: 'x',
      language: null,
      requestId: 'req-3',
    })
  })

  it('drops an unknown language but keeps the code', () => {
    const frame = parseRoomFrame({
      type: 'snapshot',
      code: 'x',
      language: 'ruby',
      request_id: 'req-4',
    })

    expect(frame).toEqual({ type: 'snapshot', code: 'x', language: null, requestId: 'req-4' })
  })

  it('parses the backend error envelope without a type field', () => {
    const frame = parseRoomFrame({
      error: {
        code: 'validation_error',
        message: 'Dados inválidos.',
        request_id: 'req-5',
      },
    })

    expect(frame).toEqual({
      type: 'error',
      code: 'validation_error',
      message: 'Dados inválidos.',
      requestId: 'req-5',
    })
  })

  it.each<[string, unknown]>([
    ['malformed JSON', 'not-json'],
    ['null payload', null],
    ['unsupported frame type', { type: 'ping' }],
    ['a snapshot without code', { type: 'snapshot', request_id: 'req' }],
    ['a snapshot with a non-string code', { type: 'snapshot', code: 42 }],
    ['a code_update without code', { type: 'code_update', request_id: 'req' }],
    [
      'a presence without count',
      { type: 'presence', room_id: 'r', role: 'viewer', request_id: 'r' },
    ],
    [
      'a presence with a negative count',
      { type: 'presence', room_id: 'r', count: -1, role: 'viewer', request_id: 'r' },
    ],
    [
      'a presence with an unknown role',
      { type: 'presence', room_id: 'r', count: 1, role: 'admin', request_id: 'r' },
    ],
    ['an error envelope without code', { error: { message: 'x' } }],
  ])('returns null for %s', (_label, raw) => {
    expect(parseRoomFrame(raw)).toBeNull()
  })
})
