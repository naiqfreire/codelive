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
