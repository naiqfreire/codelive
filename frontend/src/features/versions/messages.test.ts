import { describe, expect, it } from 'vitest'
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../shared/http'
import { versionsErrorMessage } from './messages'

const FALLBACK = 'Não foi possível carregar o histórico. Tente novamente.'

describe('versionsErrorMessage', () => {
  it('maps the session error', () => {
    const error = new ApiError(401, 'not_authenticated', 'x', 'req-1')

    expect(versionsErrorMessage(error, FALLBACK)).toBe('Sua sessão expirou. Entre novamente.')
  })

  it('maps a non-owner error', () => {
    const error = new ApiError(403, 'forbidden', 'x', 'req-1')

    expect(versionsErrorMessage(error, FALLBACK)).toBe(
      'Você não tem permissão para ver o histórico desta sala.',
    )
  })

  it('maps a missing room', () => {
    const error = new ApiError(404, 'room_not_found', 'x', 'req-1')

    expect(versionsErrorMessage(error, FALLBACK)).toBe(
      'Sala não encontrada. Volte para a lista de salas.',
    )
  })

  it('maps a closed room', () => {
    const error = new ApiError(409, 'room_closed', 'x', 'req-1')

    expect(versionsErrorMessage(error, FALLBACK)).toBe(
      'Esta sala foi encerrada: não é possível restaurar versões.',
    )
  })

  it('maps an unknown version', () => {
    const error = new ApiError(404, 'version_not_found', 'x', 'req-1')

    expect(versionsErrorMessage(error, FALLBACK)).toBe(
      'Versão não encontrada. Atualize o histórico e tente novamente.',
    )
  })

  it('maps a network failure', () => {
    const error = new ApiError(0, 'network_error', 'x', null)

    expect(versionsErrorMessage(error, FALLBACK)).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('shows the backend validation message as-is', () => {
    const error = new ApiError(422, 'validation_error', 'Informe um id válido.', 'req-1')

    expect(versionsErrorMessage(error, FALLBACK)).toBe('Informe um id válido.')
  })

  it('falls back for an unknown code and for a non-API error', () => {
    expect(versionsErrorMessage(new ApiError(500, 'internal_error', 'x', null), FALLBACK)).toBe(
      FALLBACK,
    )
    expect(versionsErrorMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK)
  })
})
