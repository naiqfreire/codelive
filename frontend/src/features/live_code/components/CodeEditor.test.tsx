import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CodeEditor } from './CodeEditor'

describe('CodeEditor', () => {
  it('renders an accessible editable editor', () => {
    render(<CodeEditor value="print('oi')" language="python" />)

    const editor = screen.getByRole('textbox', { name: /editor de código/i })
    expect(editor).toHaveAttribute('contenteditable', 'true')
    expect(editor).toHaveTextContent("print('oi')")
  })

  it('renders a read-only editor for spectators', () => {
    render(<CodeEditor value="print('oi')" language="python" readOnly label="Código da sala" />)

    const editor = screen.getByRole('textbox', { name: /código da sala/i })
    expect(editor).toHaveAttribute('contenteditable', 'false')
    expect(editor).toHaveAttribute('aria-readonly', 'true')
  })

  it('applies external snapshots without losing the editor', async () => {
    const { rerender } = render(<CodeEditor value="linha 1" language="python" readOnly />)

    rerender(<CodeEditor value="linha 2" language="python" readOnly />)

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveTextContent('linha 2')
    })
  })

  it('keeps the content when the language changes', async () => {
    const { rerender } = render(<CodeEditor value="int x;" language="c" />)

    rerender(<CodeEditor value="int x;" language="java" />)

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveTextContent('int x;')
    })
  })
})
