import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/http'
import type { LoginCredentials } from '../../features/auth'
import LoginPage from './LoginPage'

function renderLogin(onSubmit?: (credentials: LoginCredentials) => Promise<void>) {
  return render(
    <MemoryRouter>
      <LoginPage onSubmit={onSubmit} />
    </MemoryRouter>,
  )
}

function fillValidCredentials() {
  fireEvent.change(screen.getByLabelText(/e-mail/i), {
    target: { value: 'aluno@example.com' },
  })
  fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo123' } })
}

describe('LoginPage', () => {
  it('shows a field error for each empty field', () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
  })

  it('focuses the first invalid field', () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(screen.getByLabelText(/e-mail/i)).toHaveFocus()
  })

  it('rejects a malformed email before calling the API', () => {
    const onSubmit = vi.fn(async () => undefined)
    renderLogin(onSubmit)

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'aluno' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo123' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('sends trimmed credentials', async () => {
    const onSubmit = vi.fn(async () => undefined)
    renderLogin(onSubmit)

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: '  aluno@example.com  ' },
    })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo123' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'aluno@example.com',
        password: 'segredo123',
      })
    })
  })

  it('shows the message for invalid credentials returned by the API', async () => {
    const onSubmit = vi.fn(async () => {
      throw new ApiError(401, 'invalid_credentials', 'Credenciais inválidas.', 'req-1')
    })
    renderLogin(onSubmit)

    fillValidCredentials()
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument()
  })

  it('falls back to a generic message for an unexpected failure', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('boom')
    })
    renderLogin(onSubmit)

    fillValidCredentials()
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(
      await screen.findByText('Não foi possível entrar. Tente novamente.'),
    ).toBeInTheDocument()
  })

  it('shows a loading state while submitting and restores afterwards', async () => {
    let resolveSubmit: () => void = () => {}
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve
        }),
    )

    renderLogin(onSubmit)

    fillValidCredentials()
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    const loadingButton = await screen.findByRole('button', { name: /entrando/i })
    expect(loadingButton).toBeDisabled()
    expect(loadingButton).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText(/e-mail/i)).toBeDisabled()
    expect(screen.getByLabelText(/senha/i)).toBeDisabled()

    resolveSubmit()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^entrar$/i })).toBeEnabled()
    })
  })
})
