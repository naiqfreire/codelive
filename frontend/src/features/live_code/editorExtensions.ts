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
  label?: string
  onChange?: (value: string) => void
  extraExtensions?: Extension
}

const DEFAULT_LABEL = 'Editor de código'

/**
 * Read-only facets. Must be the only provider of `EditorState.readOnly`,
 * `EditorView.editable` and `aria-readonly`, always inside a compartment:
 * both facets keep the FIRST value in extension order, so a second provider
 * (for example set at creation) would freeze the editor and make a later
 * reconfigure a no-op (#48).
 */
export function readOnlyExtensions(readOnly: boolean): Extension {
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.contentAttributes.of({ 'aria-readonly': String(readOnly) }),
  ]
}

export function createEditorState({
  doc,
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
      EditorView.contentAttributes.of({
        'aria-label': label,
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
 *
 * Only the differing range is replaced (common prefix/suffix trimmed), so the
 * cursor and selection outside that range survive a snapshot or `code_update`.
 */
export function syncDocument(view: EditorView, value: string): void {
  const current = view.state.doc.toString()

  if (current === value) {
    return
  }

  let start = 0
  const maxStart = Math.min(current.length, value.length)

  while (start < maxStart && current[start] === value[start]) {
    start += 1
  }

  let currentEnd = current.length
  let valueEnd = value.length

  while (
    currentEnd > start &&
    valueEnd > start &&
    current[currentEnd - 1] === value[valueEnd - 1]
  ) {
    currentEnd -= 1
    valueEnd -= 1
  }

  view.dispatch({
    changes: { from: start, to: currentEnd, insert: value.slice(start, valueEnd) },
  })
}
