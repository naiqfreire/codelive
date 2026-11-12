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

  it('parses the backend snapshot frame', () => {
    const frame = parseRoomFrame({
      type: 'snapshot',
      room_id: 'room-1',
      content: "print('oi')",
      language: 'python',
      content_hash: 'sha256:abc',
      request_id: 'req-2',
    })

    expect(frame).toEqual({
      type: 'snapshot',
      content: "print('oi')",
      language: 'python',
      contentHash: 'sha256:abc',
      requestId: 'req-2',
    })
  })

  it('parses the backend code_update frame without a language', () => {
    const frame = parseRoomFrame({
      type: 'code_update',
      room_id: 'room-1',
      content: 'print(2)',
      content_hash: 'sha256:def',
      request_id: 'req-3',
    })

    expect(frame).toEqual({
      type: 'code_update',
      content: 'print(2)',
      contentHash: 'sha256:def',
      requestId: 'req-3',
    })
  })

  it('ignores a stray language on code_update', () => {
    const frame = parseRoomFrame({
      type: 'code_update',
      content: 'x',
      language: 'java',
      content_hash: 'h',
      request_id: 'req-4',
    })

    expect(frame).toEqual({
      type: 'code_update',
      content: 'x',
      contentHash: 'h',
      requestId: 'req-4',
    })
  })

  it('tolerates a missing content_hash', () => {
    const frame = parseRoomFrame({
      type: 'snapshot',
      content: 'x',
      language: 'python',
      request_id: 'req-5',
    })

    expect(frame).toEqual({
      type: 'snapshot',
      content: 'x',
      language: 'python',
      contentHash: null,
      requestId: 'req-5',
    })
  })

  it('drops an unknown language but keeps the content', () => {
    const frame = parseRoomFrame({
      type: 'snapshot',
      content: 'x',
      language: 'ruby',
      content_hash: 'h',
      request_id: 'req-6',
    })

    expect(frame).toEqual({
      type: 'snapshot',
      content: 'x',
      language: null,
      contentHash: 'h',
      requestId: 'req-6',
    })
  })

  it('parses the backend error envelope without a type field', () => {
    const frame = parseRoomFrame({
      error: {
        code: 'validation_error',
        message: 'Dados inválidos.',
        request_id: 'req-7',
      },
    })

    expect(frame).toEqual({
      type: 'error',
      code: 'validation_error',
      message: 'Dados inválidos.',
      requestId: 'req-7',
    })
  })

  it.each<[string, unknown]>([
    ['malformed JSON', 'not-json'],
    ['null payload', null],
    ['unsupported frame type', { type: 'ping' }],
    ['a snapshot without content', { type: 'snapshot', request_id: 'req' }],
    ['a snapshot using the legacy code field', { type: 'snapshot', code: 'x', request_id: 'req' }],
    ['a snapshot with a non-string content', { type: 'snapshot', content: 42 }],
    ['a code_update without content', { type: 'code_update', request_id: 'req' }],
    ['a code_update using the legacy code field', { type: 'code_update', code: 'x' }],
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
