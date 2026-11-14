export const ACCESS_CODE_LENGTH = 6

/**
 * Must match the backend alphabet (`app/features/rooms/service.py`):
 * A–Z without the ambiguous I/O, plus digits 2–9.
 */
export const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const ACCESS_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/

export function normalizeAccessCode(value: string): string {
  return Array.from(value.toUpperCase())
    .filter((character) => ACCESS_CODE_ALPHABET.includes(character))
    .join('')
    .slice(0, ACCESS_CODE_LENGTH)
}

export function isValidAccessCode(value: string): boolean {
  return ACCESS_CODE_PATTERN.test(value)
}

export type AccessCodeValidation =
  | { ok: true; value: string }
  | { ok: false; error: string }

const EMPTY_ERROR = 'Informe o código de acesso.'
const INCOMPLETE_ERROR = `O código de acesso tem ${ACCESS_CODE_LENGTH} caracteres.`

/**
 * Validates the code typed on the spectator entry screen.
 *
 * Normalization runs first, so the only reachable failures are an empty value
 * and an incomplete code: characters outside the backend alphabet are removed
 * by `normalizeAccessCode` before the length check.
 */
export function validateAccessCode(value: string): AccessCodeValidation {
  const normalized = normalizeAccessCode(value)

  if (normalized === '') {
    return { ok: false, error: EMPTY_ERROR }
  }

  if (normalized.length < ACCESS_CODE_LENGTH) {
    return { ok: false, error: INCOMPLETE_ERROR }
  }

  return { ok: true, value: normalized }
}
