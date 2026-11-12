import { describe, expect, it } from 'vitest'
import { buildRoomSocketUrl } from './socketUrl'

describe('buildRoomSocketUrl', () => {
  it('builds a ws url from an http origin', () => {
    expect(buildRoomSocketUrl({ origin: 'http://localhost:5173', roomId: 'room-1' })).toBe(
      'ws://localhost:5173/api/ws/rooms/room-1',
    )
  })

  it('builds a wss url from an https origin', () => {
    expect(buildRoomSocketUrl({ origin: 'https://codelive.example.com', roomId: 'room-1' })).toBe(
      'wss://codelive.example.com/api/ws/rooms/room-1',
    )
  })

  it('encodes the room id in the path', () => {
    expect(buildRoomSocketUrl({ origin: 'http://localhost:5173', roomId: 'a/b' })).toBe(
      'ws://localhost:5173/api/ws/rooms/a%2Fb',
    )
  })
})
