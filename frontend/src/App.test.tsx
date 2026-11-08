import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('redirects to the login screen', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument()
  })
})
