/** Public auth types shared by the context, the service layer and the pages. */

export type AuthUser = {
  id: string
  name: string
  email: string
  createdAt: string
}

export type LoginCredentials = {
  email: string
  password: string
}

export type RegisterPayload = {
  name: string
  email: string
  password: string
}

/** Wire shape of `UserOut` in the backend `auth` slice. */
export type UserResponse = {
  id: string
  name: string
  email: string
  created_at: string
}
