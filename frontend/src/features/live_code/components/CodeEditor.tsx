import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'
import type { RoomLanguage } from '../../rooms'
import { createEditorState, readOnlyExtensions, syncDocument } from '../editorExtensions'
import { loadLanguageExtension } from '../editorLanguages'

type CodeEditorProps = {
  value: string
  language: RoomLanguage
  readOnly?: boolean
  onChange?: (value: string) => void
  label?: string
  className?: string
}

const DEFAULT_LABEL = 'Editor de código'

export function CodeEditor({
  value,
  language,
  readOnly = false,
  onChange,
  label = DEFAULT_LABEL,
  className = '',
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const syncingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const initialValueRef = useRef(value)
  const initialReadOnlyRef = useRef(readOnly)
  const initialLabelRef = useRef(label)

  onChangeRef.current = onChange

  const [compartments] = useState(() => ({
    language: new Compartment(),
    readOnly: new Compartment(),
  }))

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const view = new EditorView({
      state: createEditorState({
        doc: initialValueRef.current,
        readOnly: initialReadOnlyRef.current,
        label: initialLabelRef.current,
        onChange: (next) => {
          if (!syncingRef.current) {
            onChangeRef.current?.(next)
          }
        },
        extraExtensions: [
          compartments.language.of([]),
          compartments.readOnly.of(readOnlyExtensions(initialReadOnlyRef.current)),
        ],
      }),
      parent: hostRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [compartments])

  useEffect(() => {
    let cancelled = false

    void loadLanguageExtension(language).then((extension) => {
      const view = viewRef.current

      if (cancelled || !view) {
        return
      }

      view.dispatch({ effects: compartments.language.reconfigure(extension) })
    })

    return () => {
      cancelled = true
    }
  }, [language, compartments])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.readOnly.reconfigure(readOnlyExtensions(readOnly)),
    })
  }, [readOnly, compartments])

  useEffect(() => {
    const view = viewRef.current

    if (!view) {
      return
    }

    syncingRef.current = true

    try {
      syncDocument(view, value)
    } finally {
      syncingRef.current = false
    }
  }, [value])

  return (
    <div
      ref={hostRef}
      data-testid="code-editor"
      className={['min-h-64 overflow-hidden rounded-lg border border-border bg-surface', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
