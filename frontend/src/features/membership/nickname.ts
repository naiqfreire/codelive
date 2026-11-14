/** Mirrors `JoinRequest.nickname` (max_length=60) and `room_members.nickname` (String(60)). */
export const NICKNAME_MAX_LENGTH = 60

export type NicknameValidation =
  | { ok: true; value: string }
  | { ok: false; error: string }

const EMPTY_ERROR = 'Informe um nickname para entrar na sala.'
const TOO_LONG_ERROR = `O nickname deve ter no máximo ${NICKNAME_MAX_LENGTH} caracteres.`

/**
 * Validates the spectator nickname before it reaches the API.
 *
 * The backend requires a nickname even for anonymous spectators
 * (`is_anonymous` means "no account", not "no name"), so an empty value is
 * always an error. Length is counted by code point because the backend counts
 * characters in Python, where an emoji is one character and not two.
 */
export function validateNickname(value: string): NicknameValidation {
  const trimmed = value.trim()

  if (trimmed === '') {
    return { ok: false, error: EMPTY_ERROR }
  }

  if (Array.from(trimmed).length > NICKNAME_MAX_LENGTH) {
    return { ok: false, error: TOO_LONG_ERROR }
  }

  return { ok: true, value: trimmed }
}
