/**
 * Maps backend error codes to messages the user can act on.
 *
 * `validation_error` is the exception: the backend already composes a
 * Portuguese message naming the offending field, so it is shown as-is.
 */
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../shared/http'

const CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_already_exists: 'Este e-mail já está cadastrado.',
  not_authenticated: 'Sua sessão expirou. Entre novamente.',
  forbidden: 'Acesso negado.',
  invalid_origin: 'Origem da requisição não permitida.',
  internal_error: 'Erro interno do servidor. Tente novamente.',
  network_error: NETWORK_ERROR_MESSAGE,
}

export function authErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.code === 'validation_error' && error.message) return error.message
  return CODE_MESSAGES[error.code] ?? fallback
}
