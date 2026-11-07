import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the CodeLive brand', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /codelive/i })).toBeInTheDocument()
  })
})
