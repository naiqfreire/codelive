import { describe, expect, it } from 'vitest'
import { codeEditorTheme, EDITOR_COLORS } from './editorTheme'

describe('editorTheme', () => {
  it('maps the editor colors to the design tokens', () => {
    expect(EDITOR_COLORS.background).toBe('#0F172A')
    expect(EDITOR_COLORS.surface).toBe('#1B2336')
    expect(EDITOR_COLORS.foreground).toBe('#F8FAFC')
    expect(EDITOR_COLORS.mutedForeground).toBe('#94A3B8')
    expect(EDITOR_COLORS.border).toBe('#475569')
    expect(EDITOR_COLORS.accent).toBe('#22C55E')
    expect(EDITOR_COLORS.ring).toBe('#FFFFFF')
  })

  it('builds a dark CodeMirror theme extension', () => {
    expect(codeEditorTheme).toBeTruthy()
  })
})
