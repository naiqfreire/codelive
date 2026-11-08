import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthLayout } from './AuthLayout'

describe('AuthLayout', () => {
  it('renders the brand and the routed content', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/" element={<h2>Conteúdo da rota</h2>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getAllByText(/codelive/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /conteúdo da rota/i })).toBeInTheDocument()
  })
})
