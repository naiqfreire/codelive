import { describe, expect, it } from 'vitest'
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../shared/http'
import { accessCodeErrorMessage, CLOSED_ROOM_MESSAGE, roomsErrorMessage } from './messages'

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

describe('accessCodeErrorMessage', () => {
  it('maps a code that does not exist', () => {
    const error = new ApiError(404, 'room_not_found', 'Sala não encontrada.', 'req-1')

    expect(accessCodeErrorMessage(error, 'fallback')).toBe(
      'Código não encontrado. Confira o código com quem criou a sala.',
    )
  })

  it('maps a closed room', () => {
    const error = new ApiError(409, 'room_closed', 'Sala encerrada.', 'req-1')

    expect(accessCodeErrorMessage(error, 'fallback')).toBe(CLOSED_ROOM_MESSAGE)
    expect(CLOSED_ROOM_MESSAGE).toBe(
      'Esta sala já foi encerrada. Peça um novo código ao dono.',
    )
  })

  it('maps the session expiry code', () => {
    const error = new ApiError(401, 'not_authenticated', 'Não autenticado.', 'req-1')

    expect(accessCodeErrorMessage(error, 'fallback')).toBe(
      'Sua sessão expirou. Entre novamente.',
    )
  })

  it('maps network failures', () => {
    const error = new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE, null)

    expect(accessCodeErrorMessage(error, 'fallback')).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('shows the backend validation message as-is', () => {
    const error = new ApiError(422, 'validation_error', 'codigo: inválido', 'req-1')

    expect(accessCodeErrorMessage(error, 'fallback')).toBe('codigo: inválido')
  })

  it('falls back for unknown errors', () => {
    expect(accessCodeErrorMessage(new Error('boom'), 'fallback')).toBe('fallback')
    expect(
      accessCodeErrorMessage(new ApiError(500, 'internal_error', 'Erro.', 'req-1'), 'fallback'),
    ).toBe('fallback')
  })
})
