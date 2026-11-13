import { describe, expect, it } from 'vitest'
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../shared/http'
import { roomsErrorMessage } from './messages'

describe('roomsErrorMessage', () => {
  it('maps the session expiry code', () => {
    const error = new ApiError(401, 'not_authenticated', 'Não autenticado.', 'req-1')

    expect(roomsErrorMessage(error, 'fallback')).toBe('Sua sessão expirou. Entre novamente.')
  })

  it('maps forbidden management attempts', () => {
    const error = new ApiError(403, 'forbidden', 'Acesso negado.', 'req-1')

    expect(roomsErrorMessage(error, 'fallback')).toBe(
      'Você não tem permissão para gerenciar esta sala.',
    )
  })

  it('maps a missing room', () => {
    const error = new ApiError(404, 'room_not_found', 'Sala não encontrada.', 'req-1')

    expect(roomsErrorMessage(error, 'fallback')).toBe('Sala não encontrada. Atualize a lista.')
  })

  it('maps an already closed room', () => {
    const error = new ApiError(409, 'room_closed', 'Sala encerrada.', 'req-1')

    expect(roomsErrorMessage(error, 'fallback')).toBe('Esta sala já foi encerrada.')
  })

  it('shows the backend validation message as-is', () => {
    const error = new ApiError(
      422,
      'validation_error',
      'language: deve ser um de: python, java, c, php, javascript',
      'req-1',
    )

    expect(roomsErrorMessage(error, 'fallback')).toBe(error.message)
  })

  it('maps network failures', () => {
    const error = new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE, null)

    expect(roomsErrorMessage(error, 'fallback')).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('falls back for unknown errors', () => {
    expect(roomsErrorMessage(new Error('boom'), 'fallback')).toBe('fallback')
    expect(roomsErrorMessage(new ApiError(500, 'internal_error', 'Erro.', 'req-1'), 'fallback')).toBe(
      'fallback',
    )
  })
})
