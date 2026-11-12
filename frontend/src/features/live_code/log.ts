/**
 * Front-end structured logging for the live channel.
 *
 * AGENTS.md requires `snapshot`/`code_update` receipt (and connection events)
 * to be logged in structured console entries with `timestamp` and `request_id`.
 * Never log session cookies or tokens.
 */
export type LiveLogEvent =
  | 'socket_open'
  | 'socket_closed'
  | 'socket_error'
  | 'join_sent'
  | 'reconnect_scheduled'
  | 'frame_received'
  | 'frame_ignored'

export function logLiveEvent(event: LiveLogEvent, details: Record<string, unknown> = {}): void {
  console.info('[live_code]', {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  })
}
