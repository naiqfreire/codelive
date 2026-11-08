import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AccessCode } from './AccessCode'

function ControlledInput({ onChange }: { onChange?: (code: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <AccessCode
      mode="input"
      value={value}
      onChange={(code) => {
        setValue(code)
        onChange?.(code)
      }}
    />
  )
}

describe('AccessCode', () => {
  it('normalizes what the spectator types', () => {
    const onChange = vi.fn()
    render(<ControlledInput onChange={onChange} />)

    const input = screen.getByLabelText(/código de acesso/i)
    fireEvent.change(input, { target: { value: 'k7-m2qxl9' } })

    expect(onChange).toHaveBeenLastCalledWith('K7M2QX')
    expect(input).toHaveValue('K7M2QX')
  })

  it('shows the error next to the field', () => {
    render(<AccessCode mode="input" value="K7" onChange={() => {}} error="Código inválido." />)

    expect(screen.getByRole('alert')).toHaveTextContent(/código inválido/i)
  })

  it('shows the access code and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(<AccessCode mode="display" code="K7M2QX" />)

    expect(screen.getByText('K7M2QX')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /copiar/i }))

    expect(writeText).toHaveBeenCalledWith('K7M2QX')
    expect(await screen.findByText(/copiado/i)).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('explains how to copy when the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {})

    render(<AccessCode mode="display" code="K7M2QX" />)
    fireEvent.click(screen.getByRole('button', { name: /copiar/i }))

    expect(await screen.findByText(/selecione o código e copie manualmente/i)).toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
