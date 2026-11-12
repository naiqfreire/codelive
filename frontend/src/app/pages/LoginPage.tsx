import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authErrorMessage, validateLogin } from '../../features/auth'
import type { FieldErrors, LoginCredentials, LoginField } from '../../features/auth'
import { Button, TextField } from '../../shared/components'

type LoginPageProps = {
  onSubmit?: (credentials: LoginCredentials) => Promise<void>
}

const FIELD_IDS: Record<LoginField, string> = {
  email: 'login-email',
  password: 'login-password',
}

const FIELD_ORDER: LoginField[] = ['email', 'password']

const GENERIC_ERROR = 'Não foi possível entrar. Tente novamente.'

export default function LoginPage({ onSubmit }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginField>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function clearFieldError(field: LoginField) {
    setFieldErrors((previous) => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const credentials = { email: email.trim(), password }
    const errors = validateLogin(credentials)
    setFieldErrors(errors)

    const firstInvalid = FIELD_ORDER.find((field) => errors[field])
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus()
      return
    }

    setIsLoading(true)

    try {
      await onSubmit?.(credentials)
    } catch (submitError) {
      setError(authErrorMessage(submitError, GENERIC_ERROR))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section aria-labelledby="login-heading">
      <h1 id="login-heading" className="font-mono text-3xl font-semibold tracking-tight">
        Entrar
      </h1>
      <p className="mt-2 text-muted-foreground">Acesse sua conta para gerenciar suas salas.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
        <TextField
          id={FIELD_IDS.email}
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            clearFieldError('email')
          }}
          placeholder="voce@exemplo.com"
          error={fieldErrors.email}
          disabled={isLoading}
        />
        <TextField
          id={FIELD_IDS.password}
          label="Senha"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            clearFieldError('password')
          }}
          placeholder="Sua senha"
          error={fieldErrors.password}
          disabled={isLoading}
        />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" isLoading={isLoading} className="w-full">
          {isLoading ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link className="font-medium text-accent underline-offset-4 hover:underline" to="/register">
          Criar conta
        </Link>
      </p>
    </section>
  )
}
