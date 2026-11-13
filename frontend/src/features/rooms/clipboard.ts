export const COPIED_MESSAGE = 'Copiado!'
export const COPY_FAILURE_MESSAGE =
  'Não foi possível copiar. Selecione o código e copie manualmente.'

/**
 * Copies text with the Clipboard API. Returns `false` when the API is missing
 * or the browser denies the write, so callers can show the manual fallback.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
