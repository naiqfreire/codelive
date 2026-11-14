/**
 * Maps backend error codes to messages the user can act on.
 *
 * `validation_error` is the exception: the backend already composes a
 * Portuguese message naming the offending field, so it is shown as-is.
 */
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../shared/http'

const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente.'

export const CLOSED_ROOM_MESSAGE =
  'Esta sala já foi encerrada. Peça um novo código ao dono.'

const CODE_MESSAGES: Record<string, string> = {
  not_authenticated: SESSION_EXPIRED_MESSAGE,
  forbidden: 'Você não tem permissão para gerenciar esta sala.',
  room_not_found: 'Sala não encontrada. Atualize a lista.',
  room_closed: 'Esta sala já foi encerrada.',
  network_error: NETWORK_ERROR_MESSAGE,
}

const ACCESS_CODE_MESSAGES: Record<string, string> = {
  not_authenticated: SESSION_EXPIRED_MESSAGE,
  room_not_found: 'Código não encontrado. Confira o código com quem criou a sala.',
  room_closed: CLOSED_ROOM_MESSAGE,
  network_error: NETWORK_ERROR_MESSAGE,
}

export function roomsErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.code === 'validation_error' && error.message) return error.message
  return CODE_MESSAGES[error.code] ?? fallback
}

/** Messages specific to the access-code lookup (step 2 of the spectator flow). */
export function accessCodeErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.code === 'validation_error' && error.message) return error.message
  return ACCESS_CODE_MESSAGES[error.code] ?? fallback
}
