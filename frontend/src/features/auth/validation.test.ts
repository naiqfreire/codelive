import { describe, expect, it } from 'vitest'
import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  hasErrors,
  validateEmail,
  validateLogin,
  validateName,
  validatePassword,
  validateRegister,
} from './validation'

describe('validateName', () => {
  it('requires a name', () => {
    expect(validateName('')).toBe('Informe seu nome.')
    expect(validateName('   ')).toBe('Informe seu nome.')
  })

  it('rejects names longer than the backend limit', () => {
    expect(validateName('a'.repeat(NAME_MAX_LENGTH + 1))).toBe(
      'O nome deve ter no máximo 120 caracteres.',
    )
  })

  it('accepts a valid name', () => {
    expect(validateName('Ana Souza')).toBeUndefined()
  })
})

describe('validateEmail', () => {
  it('requires an email', () => {
    expect(validateEmail('  ')).toBe('Informe seu e-mail.')
  })

  it('rejects malformed emails', () => {
    expect(validateEmail('aluno')).toBe('Informe um e-mail válido.')
    expect(validateEmail('aluno@example')).toBe('Informe um e-mail válido.')
    expect(validateEmail('aluno @example.com')).toBe('Informe um e-mail válido.')
  })

  it('accepts a valid email', () => {
    expect(validateEmail('aluno@example.com')).toBeUndefined()
  })
})

describe('validatePassword', () => {
  it('requires a password', () => {
    expect(validatePassword('')).toBe('Informe sua senha.')
  })

  it('enforces the minimum length from the backend', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe(
      'A senha deve ter no mínimo 8 caracteres.',
    )
  })

  it('enforces the maximum length from the backend', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      'A senha deve ter no máximo 128 caracteres.',
    )
  })

  it('accepts a valid password', () => {
    expect(validatePassword('segredo123')).toBeUndefined()
  })
})

describe('validateLogin', () => {
  it('reports every empty field', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Informe seu e-mail.',
      password: 'Informe sua senha.',
    })
  })

  it('returns no errors for valid credentials', () => {
    expect(validateLogin({ email: 'aluno@example.com', password: 'segredo123' })).toEqual({})
  })
})

describe('validateRegister', () => {
  it('reports every empty field', () => {
    expect(validateRegister({ name: '', email: '', password: '' })).toEqual({
      name: 'Informe seu nome.',
      email: 'Informe seu e-mail.',
      password: 'Informe sua senha.',
    })
  })

  it('returns no errors for valid data', () => {
    expect(
      validateRegister({ name: 'Ana', email: 'ana@example.com', password: 'segredo123' }),
    ).toEqual({})
  })
})

describe('hasErrors', () => {
  it('detects whether a field error map has entries', () => {
    expect(hasErrors({})).toBe(false)
    expect(hasErrors({ email: 'Informe seu e-mail.' })).toBe(true)
  })
})
