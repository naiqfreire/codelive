/** Composition: wires the login form to the auth context and the router. */
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth'
import type { LoginCredentials } from '../../features/auth'
import LoginPage from '../pages/LoginPage'
import { resolveRedirectTarget } from './redirect'

export default function LoginRoute() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(credentials: LoginCredentials) {
    await login(credentials)
    navigate(resolveRedirectTarget(location.state), { replace: true })
  }

  return <LoginPage onSubmit={handleSubmit} />
}
