import { afterEach, describe, expect, it, vi } from 'vitest'
import { logLiveEvent } from './log'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logLiveEvent', () => {
  it('writes a structured entry with a timestamp', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    logLiveEvent('frame_received', { request_id: 'req-1', frame_type: 'snapshot' })

    expect(info).toHaveBeenCalledTimes(1)

    const [prefix, entry] = info.mock.calls[0] as [string, Record<string, unknown>]
    expect(prefix).toBe('[live_code]')
    expect(entry).toMatchObject({
      event: 'frame_received',
      request_id: 'req-1',
      frame_type: 'snapshot',
    })
    expect(typeof entry.timestamp).toBe('string')
    expect(Number.isNaN(Date.parse(entry.timestamp as string))).toBe(false)
  })
})
