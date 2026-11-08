import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

type LoginCredentials = { email: string; password: string }

function renderLogin(onSubmit?: (credentials: LoginCredentials) => Promise<void>) {
  return render(
    <MemoryRouter>
      <LoginPage onSubmit={onSubmit} />
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('shows an error when submitting empty fields', () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/informe e-mail e senha/i)
  })

  it('focuses the field when the user interacts with it', () => {
    renderLogin()

    const email = screen.getByLabelText(/e-mail/i)
    email.focus()

    expect(email).toHaveFocus()
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

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'aluno@example.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo' } })
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
