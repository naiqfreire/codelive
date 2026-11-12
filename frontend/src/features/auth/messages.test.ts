import { describe, expect, it } from 'vitest'
import { ApiError } from '../../shared/http'
import { authErrorMessage } from './messages'

const fallback = 'Não foi possível concluir. Tente novamente.'

function apiError(code: string, message = 'mensagem do servidor', status = 400) {
  return new ApiError(status, code, message, 'req-1')
}

describe('authErrorMessage', () => {
  it('translates the invalid credentials code', () => {
    expect(authErrorMessage(apiError('invalid_credentials', 'x', 401), fallback)).toBe(
      'E-mail ou senha incorretos.',
    )
  })

  it('translates the duplicate email code', () => {
    expect(authErrorMessage(apiError('email_already_exists', 'x', 409), fallback)).toBe(
      'Este e-mail já está cadastrado.',
    )
  })

  it('keeps the server message for validation errors', () => {
    expect(
      authErrorMessage(
        apiError('validation_error', 'senha: mínimo de 8 caracteres', 422),
        fallback,
      ),
    ).toBe('senha: mínimo de 8 caracteres')
  })

  it('translates the not authenticated code', () => {
    expect(authErrorMessage(apiError('not_authenticated', 'x', 401), fallback)).toBe(
      'Sua sessão expirou. Entre novamente.',
    )
  })

  it('translates the invalid origin code', () => {
    expect(authErrorMessage(apiError('invalid_origin', 'x', 403), fallback)).toBe(
      'Origem da requisição não permitida.',
    )
  })

  it('translates network failures', () => {
    expect(authErrorMessage(apiError('network_error', 'x', 0), fallback)).toBe(
      'Não foi possível conectar ao servidor. Tente novamente.',
    )
  })

  it('falls back for an unknown code or a non-ApiError value', () => {
    expect(authErrorMessage(apiError('teapot'), fallback)).toBe(fallback)
    expect(authErrorMessage(new Error('boom'), fallback)).toBe(fallback)
    expect(authErrorMessage('boom', fallback)).toBe(fallback)
  })
})
