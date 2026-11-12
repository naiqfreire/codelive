/** Public API of the auth slice. Other slices and the app import only this. */
export { AuthProvider } from './AuthProvider'
export { GuestRoute } from './GuestRoute'
export { ProtectedRoute } from './ProtectedRoute'
export { authApi } from './api'
export type { AuthApi } from './api'
export { AuthContext, useAuth } from './context'
export type { AuthContextValue, AuthStatus } from './context'
export { authErrorMessage } from './messages'
export type { AuthUser, LoginCredentials, RegisterPayload, UserResponse } from './types'
export {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  hasErrors,
  validateEmail,
  validateLogin,
  validateName,
  validatePassword,
  validateRegister,
} from './validation'
export type { FieldErrors, LoginField, RegisterField } from './validation'
