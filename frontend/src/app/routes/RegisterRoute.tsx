/** Composition: wires the registration form to the auth context and the router. */
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth'
import type { RegisterPayload } from '../../features/auth'
import RegisterPage from '../pages/RegisterPage'
import { resolveRedirectTarget } from './redirect'

export default function RegisterRoute() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(payload: RegisterPayload) {
    await register(payload)
    navigate(resolveRedirectTarget(location.state), { replace: true })
  }

  return <RegisterPage onSubmit={handleSubmit} />
}
