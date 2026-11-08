import { describe, expect, it } from 'vitest'
import { ACCESS_CODE_LENGTH, isValidAccessCode, normalizeAccessCode } from './accessCode'

describe('normalizeAccessCode', () => {
  it('uppercases the input', () => {
    expect(normalizeAccessCode('k7m2qx')).toBe('K7M2QX')
  })

  it('removes spaces, punctuation and ambiguous characters', () => {
    expect(normalizeAccessCode(' k7-m2 qx! ')).toBe('K7M2QX')
    expect(normalizeAccessCode('aOiL2b')).toBe('AL2B')
  })

  it('keeps at most six characters', () => {
    expect(normalizeAccessCode('K7M2QXL9')).toBe('K7M2QX')
    expect(normalizeAccessCode('K7M2QXL9')).toHaveLength(ACCESS_CODE_LENGTH)
  })
})

describe('isValidAccessCode', () => {
  it('accepts a six-character code from the backend alphabet', () => {
    expect(ACCESS_CODE_LENGTH).toBe(6)
    expect(isValidAccessCode('K7M2QX')).toBe(true)
    expect(isValidAccessCode('ABCDEF')).toBe(true)
    expect(isValidAccessCode('LMNPQR')).toBe(true)
  })

  it('rejects wrong length, lowercase and ambiguous characters', () => {
    expect(isValidAccessCode('K7M2Q')).toBe(false)
    expect(isValidAccessCode('K7M2QXA')).toBe(false)
    expect(isValidAccessCode('k7m2qx')).toBe(false)
    expect(isValidAccessCode('K7M2QO')).toBe(false)
    expect(isValidAccessCode('K7M2QI')).toBe(false)
    expect(isValidAccessCode('K7M2Q1')).toBe(false)
    expect(isValidAccessCode('K7M2Q0')).toBe(false)
  })
})
