import { describe, expect, it } from 'vitest'
import { NICKNAME_MAX_LENGTH, validateNickname } from './nickname'

describe('validateNickname', () => {
  it('accepts a simple nickname', () => {
    expect(validateNickname('Ana')).toEqual({ ok: true, value: 'Ana' })
  })

  it('trims the surrounding whitespace', () => {
    expect(validateNickname('   Ana Souza  ')).toEqual({ ok: true, value: 'Ana Souza' })
  })

  it('rejects an empty nickname', () => {
    const result = validateNickname('')

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/informe um nickname/i)
  })

  it('rejects a whitespace-only nickname', () => {
    const result = validateNickname('    ')

    expect(result.ok).toBe(false)
  })

  it('accepts exactly the maximum length', () => {
    const value = 'a'.repeat(NICKNAME_MAX_LENGTH)

    expect(validateNickname(value)).toEqual({ ok: true, value })
  })

  it('rejects one character above the maximum', () => {
    const result = validateNickname('a'.repeat(NICKNAME_MAX_LENGTH + 1))

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(new RegExp(String(NICKNAME_MAX_LENGTH)))
  })

  it('counts characters by code point instead of UTF-16 units', () => {
    const emoji = '🙂'
    expect(emoji).toHaveLength(2)

    expect(validateNickname(emoji.repeat(NICKNAME_MAX_LENGTH)).ok).toBe(true)
    expect(validateNickname(emoji.repeat(NICKNAME_MAX_LENGTH + 1)).ok).toBe(false)
  })

  it('rejects a nickname that is too long after trimming', () => {
    const result = validateNickname(`  ${'a'.repeat(NICKNAME_MAX_LENGTH + 1)}  `)

    expect(result.ok).toBe(false)
  })
})
