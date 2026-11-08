import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import RegisterPage from './RegisterPage'

type RegisterData = { name: string; email: string; password: string }

function renderRegister(onSubmit?: (data: RegisterData) => Promise<void>) {
  return render(
    <MemoryRouter>
      <RegisterPage onSubmit={onSubmit} />
    </MemoryRouter>,
  )
}

describe('RegisterPage', () => {
  it('shows an error when submitting empty fields', () => {
    renderRegister()

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/preencha nome, e-mail e senha/i)
  })

  it('shows a loading state while submitting and restores afterwards', async () => {
    let resolveSubmit: () => void = () => {}
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve
        }),
    )

    renderRegister(onSubmit)

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Aluno' } })
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'aluno@example.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo' } })
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    const loadingButton = await screen.findByRole('button', { name: /criando conta/i })
    expect(loadingButton).toBeDisabled()
    expect(loadingButton).toHaveAttribute('aria-busy', 'true')

    resolveSubmit()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^criar conta$/i })).toBeEnabled()
    })
  })
})
