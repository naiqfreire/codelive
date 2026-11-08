import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, TextField } from '../../shared/components'

export type RegisterData = {
  name: string
  email: string
  password: string
}

type RegisterPageProps = {
  onSubmit?: (data: RegisterData) => Promise<void>
}

export default function RegisterPage({ onSubmit }: RegisterPageProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Preencha nome, e-mail e senha para criar a conta.')
      return
    }

    setIsLoading(true)

    try {
      await onSubmit?.({ name, email, password })
    } catch {
      setError('Não foi possível criar a conta. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section aria-labelledby="register-heading">
      <h1 id="register-heading" className="font-mono text-3xl font-semibold tracking-tight">
        Criar conta
      </h1>
      <p className="mt-2 text-muted-foreground">
        Cadastre-se para criar salas e compartilhar código ao vivo.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Nome"
          type="text"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Seu nome"
          disabled={isLoading}
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Crie uma senha"
          disabled={isLoading}
        />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" isLoading={isLoading} className="w-full">
          {isLoading ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link className="font-medium text-accent underline-offset-4 hover:underline" to="/login">
          Entrar
        </Link>
      </p>
    </section>
  )
}
