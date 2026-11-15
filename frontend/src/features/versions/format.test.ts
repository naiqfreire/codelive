import { describe, expect, it } from 'vitest'
import type { CodeVersion } from './types'
import { formatVersionDateTime, orderVersionsNewestFirst } from './format'

function version(id: string, createdAt: string): CodeVersion {
  return {
    id,
    createdAt,
    contentHash: 'a'.repeat(64),
    language: 'python',
    authorId: null,
  }
}

describe('formatVersionDateTime', () => {
  it('formats date and time in São Paulo', () => {
    expect(formatVersionDateTime('2026-11-10T12:05:00Z')).toBe('10/11/2026 às 09:05:00')
  })

  it('renders midnight as 00:00:00', () => {
    expect(formatVersionDateTime('2026-11-10T03:00:00Z')).toBe('10/11/2026 às 00:00:00')
  })

  it('returns an empty string when the timestamp cannot be parsed', () => {
    expect(formatVersionDateTime('not-a-date')).toBe('')
  })
})

describe('orderVersionsNewestFirst', () => {
  it('orders by createdAt descending', () => {
    const oldest = version('a', '2026-11-10T12:00:00Z')
    const newest = version('b', '2026-11-10T12:05:00Z')

    expect(orderVersionsNewestFirst([oldest, newest])).toEqual([newest, oldest])
  })

  it('breaks a createdAt tie by id descending', () => {
    const low = version('aaaaaaaa-0000-4000-8000-000000000001', '2026-11-10T12:05:00Z')
    const high = version('bbbbbbbb-0000-4000-8000-000000000002', '2026-11-10T12:05:00Z')

    expect(orderVersionsNewestFirst([low, high])).toEqual([high, low])
  })

  it('does not mutate the input list', () => {
    const oldest = version('a', '2026-11-10T12:00:00Z')
    const newest = version('b', '2026-11-10T12:05:00Z')
    const input = [oldest, newest]

    orderVersionsNewestFirst(input)

    expect(input).toEqual([oldest, newest])
  })
})
