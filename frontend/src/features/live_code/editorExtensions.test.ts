import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEditorState, syncDocument } from './editorExtensions'

const views: EditorView[] = []

function mountEditor(options: Parameters<typeof createEditorState>[0]) {
  const parent = document.createElement('div')
  document.body.append(parent)
  const view = new EditorView({ state: createEditorState(options), parent })
  views.push(view)
  return view
}

afterEach(() => {
  while (views.length > 0) {
    const view = views.pop()
    view?.destroy()
  }
  document.body.innerHTML = ''
})

describe('createEditorState', () => {
  it('starts with the given document', () => {
    const state = createEditorState({ doc: 'print("oi")' })

    expect(state.doc.toString()).toBe('print("oi")')
  })

  it('is editable and labeled by default', () => {
    const view = mountEditor({ doc: 'x' })

    expect(view.state.facet(EditorState.readOnly)).toBe(false)
    expect(view.state.facet(EditorView.editable)).toBe(true)
    expect(view.contentDOM.getAttribute('contenteditable')).toBe('true')
    expect(view.contentDOM.getAttribute('aria-label')).toBe('Editor de código')
    expect(view.contentDOM.getAttribute('aria-readonly')).toBe('false')
  })

  it('enforces read-only for spectators', () => {
    const view = mountEditor({ doc: 'x', readOnly: true, label: 'Código da sala' })

    expect(view.state.facet(EditorState.readOnly)).toBe(true)
    expect(view.state.facet(EditorView.editable)).toBe(false)
    expect(view.contentDOM.getAttribute('contenteditable')).toBe('false')
    expect(view.contentDOM.getAttribute('aria-label')).toBe('Código da sala')
    expect(view.contentDOM.getAttribute('aria-readonly')).toBe('true')
  })

  it('reports document changes to the listener', () => {
    const onChange = vi.fn()
    const view = mountEditor({ doc: 'a', onChange })

    view.dispatch({ changes: { from: 0, to: 1, insert: 'b' } })

    expect(onChange).toHaveBeenLastCalledWith('b')
  })

  it('does not report updates that do not change the document', () => {
    const onChange = vi.fn()
    const view = mountEditor({ doc: 'a', onChange })

    view.dispatch({ selection: { anchor: 0 } })

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('syncDocument', () => {
  it('does nothing when the content already matches', () => {
    const view = mountEditor({ doc: 'K7M2QX' })
    const dispatch = vi.spyOn(view, 'dispatch')

    syncDocument(view, 'K7M2QX')

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('replaces the content when it differs', () => {
    const view = mountEditor({ doc: 'antigo' })

    syncDocument(view, 'novo')

    expect(view.state.doc.toString()).toBe('novo')
  })
})
