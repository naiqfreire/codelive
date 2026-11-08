import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { bracketMatching } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { codeEditorThemeExtensions } from './editorTheme'

export type CreateEditorStateOptions = {
  doc: string
  readOnly?: boolean
  label?: string
  onChange?: (value: string) => void
  extraExtensions?: Extension
}

const DEFAULT_LABEL = 'Editor de código'

export function readOnlyExtensions(readOnly: boolean): Extension {
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.contentAttributes.of({ 'aria-readonly': String(readOnly) }),
  ]
}

export function createEditorState({
  doc,
  readOnly = false,
  label = DEFAULT_LABEL,
  onChange,
  extraExtensions = [],
}: CreateEditorStateOptions): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      bracketMatching(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      codeEditorThemeExtensions,
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.contentAttributes.of({
        'aria-label': label,
        'aria-readonly': String(readOnly),
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange?.(update.state.doc.toString())
        }
      }),
      extraExtensions,
    ],
  })
}

/**
 * Applies an external value (for example, a WebSocket `snapshot`) without
 * resetting the document when the content is already the same.
 */
export function syncDocument(view: EditorView, value: string): void {
  const current = view.state.doc.toString()

  if (current === value) {
    return
  }

  view.dispatch({
    changes: { from: 0, to: current.length, insert: value },
  })
}
