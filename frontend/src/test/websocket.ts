/**
 * Minimal WebSocket stand-in for route tests.
 *
 * The live hook only needs the browser API surface; this fake never opens a
 * real connection, so tests can render `useRoomConnection` without network.
 */
import { vi } from 'vitest'

export class SilentWebSocket {
  static instances: SilentWebSocket[] = []

  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(public url: string) {
    SilentWebSocket.instances.push(this)
  }

  send() {}

  close() {
    this.readyState = 3
  }
}

export function installSilentWebSocket() {
  SilentWebSocket.instances = []
  vi.stubGlobal('WebSocket', SilentWebSocket)
}
