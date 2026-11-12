import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  authErrorMessage,
  validateRegister,
} from '../../features/auth'
import type { FieldErrors, RegisterField, RegisterPayload } from '../../features/auth'
import { Button, TextField } from '../../shared/components'

type RegisterPageProps = {
  onSubmit?: (data: RegisterPayload) => Promise<void>
}

const FIELD_IDS: Record<RegisterField, string> = {
  name: 'register-name',
  email: 'register-email',
  password: 'register-password',
}

const FIELD_ORDER: RegisterField[] = ['name', 'email', 'password']

const PASSWORD_HINT = `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`
const GENERIC_ERROR = 'Não foi possível criar a conta. Tente novamente.'

export default function RegisterPage({ onSubmit }: RegisterPageProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegisterField>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function clearFieldError(field: RegisterField) {
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

    const data = { name: name.trim(), email: email.trim(), password }
    const errors = validateRegister(data)
    setFieldErrors(errors)

    const firstInvalid = FIELD_ORDER.find((field) => errors[field])
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus()
      return
    }

    setIsLoading(true)

    try {
      await onSubmit?.(data)
    } catch (submitError) {
      setError(authErrorMessage(submitError, GENERIC_ERROR))
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
          id={FIELD_IDS.name}
          label="Nome"
          type="text"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            clearFieldError('name')
          }}
          placeholder="Seu nome"
          error={fieldErrors.name}
          disabled={isLoading}
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            clearFieldError('password')
          }}
          placeholder="Crie uma senha"
          hint={PASSWORD_HINT}
          error={fieldErrors.password}
          maxLength={PASSWORD_MAX_LENGTH}
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
