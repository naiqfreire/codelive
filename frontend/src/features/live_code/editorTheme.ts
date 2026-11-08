import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/**
 * CodeMirror needs concrete CSS values, so the design tokens are mirrored here.
 * Source of truth: `frontend/tailwind.config.js` and `docs/DESIGN_SYSTEM.md`.
 * This is the only place outside Tailwind where the palette may be written as hex.
 */
export const EDITOR_COLORS = {
  background: '#0F172A',
  surface: '#1B2336',
  foreground: '#F8FAFC',
  mutedForeground: '#94A3B8',
  border: '#475569',
  accent: '#22C55E',
  ring: '#FFFFFF',
  selection: '#22C55E33',
  activeLine: '#1B233680',
  keyword: '#C084FC',
  string: '#86EFAC',
  comment: '#94A3B8',
  number: '#FBBF24',
  function: '#60A5FA',
  type: '#5EEAD4',
  operator: '#CBD5E1',
  invalid: '#EF4444',
} as const

export const codeEditorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: EDITOR_COLORS.surface,
      color: EDITOR_COLORS.foreground,
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
      fontSize: '14px',
    },
    '&.cm-focused': {
      outline: `2px solid ${EDITOR_COLORS.ring}`,
      outlineOffset: '2px',
    },
    '.cm-content': {
      caretColor: EDITOR_COLORS.accent,
      padding: '12px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: EDITOR_COLORS.accent,
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: EDITOR_COLORS.selection,
    },
    '.cm-gutters': {
      backgroundColor: EDITOR_COLORS.background,
      color: EDITOR_COLORS.mutedForeground,
      borderRight: `1px solid ${EDITOR_COLORS.border}`,
    },
    '.cm-activeLine': {
      backgroundColor: EDITOR_COLORS.activeLine,
    },
    '.cm-activeLineGutter': {
      backgroundColor: EDITOR_COLORS.activeLine,
      color: EDITOR_COLORS.foreground,
    },
    '.cm-scroller': {
      overflow: 'auto',
    },
  },
  { dark: true },
)

const codeEditorHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: EDITOR_COLORS.keyword },
  { tag: [tags.string, tags.special(tags.string)], color: EDITOR_COLORS.string },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: EDITOR_COLORS.comment,
    fontStyle: 'italic',
  },
  { tag: [tags.number, tags.bool, tags.null], color: EDITOR_COLORS.number },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: EDITOR_COLORS.function,
  },
  { tag: [tags.typeName, tags.className], color: EDITOR_COLORS.type },
  { tag: [tags.operator, tags.punctuation], color: EDITOR_COLORS.operator },
  { tag: tags.invalid, color: EDITOR_COLORS.invalid },
])

export const codeEditorThemeExtensions: Extension = [
  codeEditorTheme,
  syntaxHighlighting(codeEditorHighlightStyle, { fallback: true }),
]
