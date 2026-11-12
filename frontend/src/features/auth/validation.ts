/**
 * Client-side form validation for the auth slice.
 *
 * The rules mirror `RegisterRequest` and `LoginRequest` in the backend auth
 * slice. The server stays the authority: this only avoids a round trip for
 * mistakes the user can fix immediately.
 */
import type { LoginCredentials, RegisterPayload } from './types'

export const NAME_MAX_LENGTH = 120
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

// Deliberately simple: EmailStr on the server is the real check.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type LoginField = 'email' | 'password'
export type RegisterField = 'name' | 'email' | 'password'
export type FieldErrors<T extends string> = Partial<Record<T, string>>

export function validateName(value: string): string | undefined {
  if (!value.trim()) return 'Informe seu nome.'
  if (value.trim().length > NAME_MAX_LENGTH) {
    return `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`
  }
  return undefined
}

export function validateEmail(value: string): string | undefined {
  const email = value.trim()
  if (!email) return 'Informe seu e-mail.'
  if (!EMAIL_PATTERN.test(email)) return 'Informe um e-mail válido.'
  return undefined
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Informe sua senha.'
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`
  }
  return undefined
}

function compact<T extends string>(errors: FieldErrors<T>): FieldErrors<T> {
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => Boolean(message)),
  ) as FieldErrors<T>
}

export function validateLogin(values: LoginCredentials): FieldErrors<LoginField> {
  return compact<LoginField>({
    email: validateEmail(values.email),
    password: validatePassword(values.password),
  })
}

export function validateRegister(values: RegisterPayload): FieldErrors<RegisterField> {
  return compact<RegisterField>({
    name: validateName(values.name),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
  })
}

export function hasErrors(errors: FieldErrors<string>): boolean {
  return Object.keys(errors).length > 0
}
