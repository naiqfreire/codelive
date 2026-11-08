import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LanguageSelector } from './LanguageSelector'

describe('LanguageSelector', () => {
  it('lists the five supported languages', () => {
    render(<LanguageSelector value="python" onChange={() => {}} />)

    const select = screen.getByLabelText(/linguagem/i)
    expect(select).toBeInTheDocument()

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Python', 'Java', 'C', 'PHP', 'JavaScript'])
  })

  it('reports the chosen language', () => {
    const onChange = vi.fn()
    render(<LanguageSelector value="python" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/linguagem/i), { target: { value: 'java' } })

    expect(onChange).toHaveBeenCalledWith('java')
  })

  it('is disabled when the room cannot be edited', () => {
    render(<LanguageSelector value="c" onChange={() => {}} disabled />)

    expect(screen.getByLabelText(/linguagem/i)).toBeDisabled()
  })
})
