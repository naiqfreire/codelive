/**
 * Maps versions error codes to messages the user can act on (RF11).
 *
 * `validation_error` is shown as-is, like `rooms/messages.ts`, because the
 * backend already writes the Portuguese message naming the field.
 */
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../shared/http'

export const VERSION_LOAD_ERROR_FALLBACK = 'Não foi possível carregar o histórico. Tente novamente.'
export const VERSION_RESTORE_ERROR_FALLBACK =
  'Não foi possível restaurar a versão. Tente novamente.'

const CODE_MESSAGES: Record<string, string> = {
  not_authenticated: 'Sua sessão expirou. Entre novamente.',
  forbidden: 'Você não tem permissão para ver o histórico desta sala.',
  room_not_found: 'Sala não encontrada. Volte para a lista de salas.',
  room_closed: 'Esta sala foi encerrada: não é possível restaurar versões.',
  version_not_found: 'Versão não encontrada. Atualize o histórico e tente novamente.',
  network_error: NETWORK_ERROR_MESSAGE,
}

export function versionsErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.code === 'validation_error' && error.message) return error.message
  return CODE_MESSAGES[error.code] ?? fallback
}
