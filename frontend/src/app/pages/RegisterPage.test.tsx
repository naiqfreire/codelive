import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/http'
import type { RegisterPayload } from '../../features/auth'
import RegisterPage from './RegisterPage'

function renderRegister(onSubmit?: (data: RegisterPayload) => Promise<void>) {
  return render(
    <MemoryRouter>
      <RegisterPage onSubmit={onSubmit} />
    </MemoryRouter>,
  )
}

function fillValidData() {
  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Ana Souza' } })
  fireEvent.change(screen.getByLabelText(/e-mail/i), {
    target: { value: 'ana@example.com' },
  })
  fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo123' } })
}

describe('RegisterPage', () => {
  it('shows a field error for each empty field', () => {
    renderRegister()

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    expect(screen.getByText('Informe seu nome.')).toBeInTheDocument()
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
  })

  it('shows the password rule as a hint', () => {
    renderRegister()

    expect(screen.getByText('Mínimo de 8 caracteres.')).toBeInTheDocument()
  })

  it('rejects a password shorter than the backend minimum', () => {
    const onSubmit = vi.fn(async () => undefined)
    renderRegister(onSubmit)

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'ana@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo' } })
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    expect(screen.getByText('A senha deve ter no mínimo 8 caracteres.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('sends trimmed values', async () => {
    const onSubmit = vi.fn(async () => undefined)
    renderRegister(onSubmit)

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: '  Ana Souza  ' } })
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: ' ana@example.com ' },
    })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo123' } })
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Ana Souza',
        email: 'ana@example.com',
        password: 'segredo123',
      })
    })
  })

  it('shows the duplicate email message returned by the API', async () => {
    const onSubmit = vi.fn(async () => {
      throw new ApiError(409, 'email_already_exists', 'E-mail já cadastrado.', 'req-1')
    })
    renderRegister(onSubmit)

    fillValidData()
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    expect(await screen.findByText('Este e-mail já está cadastrado.')).toBeInTheDocument()
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

    fillValidData()
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
