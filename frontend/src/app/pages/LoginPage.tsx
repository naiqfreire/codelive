import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, TextField } from '../../shared/components'

export type LoginCredentials = {
  email: string
  password: string
}

type LoginPageProps = {
  onSubmit?: (credentials: LoginCredentials) => Promise<void>
}

export default function LoginPage({ onSubmit }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password.trim()) {
      setError('Informe e-mail e senha para entrar.')
      return
    }

    setIsLoading(true)

    try {
      await onSubmit?.({ email, password })
    } catch {
      setError('Não foi possível entrar. Tente novamente.')
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
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@exemplo.com"
          disabled={isLoading}
        />
        <TextField
          label="Senha"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Sua senha"
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
