import { describe, expect, it } from 'vitest'
import { formatRoomDate } from './format'

describe('formatRoomDate', () => {
  it('formats an ISO date in the Brazilian format', () => {
    expect(formatRoomDate('2026-11-09T17:30:00Z')).toBe('09/11/2026')
  })

  it('uses the Brazilian timezone instead of the machine one', () => {
    // 01:00 UTC on Nov 10 is still Nov 9 in São Paulo (22:00).
    expect(formatRoomDate('2026-11-10T01:00:00Z')).toBe('09/11/2026')
  })

  it('returns an empty string for an invalid date', () => {
    expect(formatRoomDate('not-a-date')).toBe('')
  })
})
