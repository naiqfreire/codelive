import { afterEach, describe, expect, it, vi } from 'vitest'
import { COPY_FAILURE_MESSAGE, COPIED_MESSAGE, copyText } from './clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('copyText', () => {
  it('copies the text with the Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyText('K7M2QX')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('K7M2QX')
    expect(COPIED_MESSAGE).toBe('Copiado!')
  })

  it('reports failure when the Clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {})

    await expect(copyText('K7M2QX')).resolves.toBe(false)
  })

  it('reports failure when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyText('K7M2QX')).resolves.toBe(false)
    expect(COPY_FAILURE_MESSAGE).toMatch(/selecione o código e copie manualmente/i)
  })
})
