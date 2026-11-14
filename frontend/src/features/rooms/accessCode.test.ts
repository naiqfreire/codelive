import { describe, expect, it } from 'vitest'
import {
  ACCESS_CODE_LENGTH,
  isValidAccessCode,
  normalizeAccessCode,
  validateAccessCode,
} from './accessCode'

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

describe('validateAccessCode', () => {
  it('normalizes and accepts a complete code', () => {
    expect(validateAccessCode('k7-m2 qx')).toEqual({ ok: true, value: 'K7M2QX' })
  })

  it('reports an empty code', () => {
    expect(validateAccessCode('   ')).toEqual({
      ok: false,
      error: 'Informe o código de acesso.',
    })
  })

  it('reports an incomplete code', () => {
    expect(validateAccessCode('K7M2Q')).toEqual({
      ok: false,
      error: 'O código de acesso tem 6 caracteres.',
    })
  })

  it('removes ambiguous characters before checking the length', () => {
    expect(validateAccessCode('K7M2QO')).toEqual({
      ok: false,
      error: 'O código de acesso tem 6 caracteres.',
    })
  })
})
