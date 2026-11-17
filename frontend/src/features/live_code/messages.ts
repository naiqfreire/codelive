/**
 * Shared limits and Portuguese copy for the live channel (#42).
 *
 * `MAX_CODE_BYTES` mirrors the backend's 256 KiB UTF-8 guard
 * (`backend/app/features/live_code/service.py`); the server remains the
 * authority and still refuses oversized content.
 */
export const MAX_CODE_BYTES = 262_144
export const CODE_SEND_DEBOUNCE_MS = 300
export const SYNC_NOTICE_DURATION_MS = 5000

export const CODE_LOADING_MESSAGE = 'Carregando código da sala…'
export const OVERSIZE_MESSAGE =
  'O código excede o limite de 256 KiB. Reduza o conteúdo para voltar a sincronizar.'
export const LATEST_VERSION_MESSAGE = 'Versão mais recente carregada do servidor.'

export const CONFLICT_TITLE = 'O servidor tem uma versão mais recente.'
export const CONFLICT_DESCRIPTION =
  'Sua edição local não foi enviada. Escolha qual versão manter.'
export const CONFLICT_ACCEPT_LABEL = 'Carregar versão do servidor'
export const CONFLICT_KEEP_LABEL = 'Manter minha edição'
