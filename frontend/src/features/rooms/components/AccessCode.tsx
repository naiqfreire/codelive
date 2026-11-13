import { useState } from 'react'
import { Button, TextField } from '../../../shared/components'
import { ACCESS_CODE_LENGTH, normalizeAccessCode } from '../accessCode'
import { COPIED_MESSAGE, COPY_FAILURE_MESSAGE, copyText } from '../clipboard'

type AccessCodeInputProps = {
  mode: 'input'
  value: string
  onChange: (code: string) => void
  error?: string
  hint?: string
  disabled?: boolean
  label?: string
}

type AccessCodeDisplayProps = {
  mode: 'display'
  code: string
  label?: string
}

export type AccessCodeProps = AccessCodeInputProps | AccessCodeDisplayProps

const DEFAULT_LABEL = 'Código de acesso'
const DEFAULT_INPUT_HINT = '6 caracteres: letras maiúsculas e números.'

export function AccessCode(props: AccessCodeProps) {
  if (props.mode === 'display') {
    return <AccessCodeDisplay code={props.code} label={props.label} />
  }

  const { value, onChange, error, hint = DEFAULT_INPUT_HINT, disabled, label } = props

  return (
    <TextField
      label={label ?? DEFAULT_LABEL}
      value={value}
      onChange={(event) => onChange(normalizeAccessCode(event.target.value))}
      error={error}
      hint={hint}
      disabled={disabled}
      inputMode="text"
      autoComplete="one-time-code"
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      maxLength={ACCESS_CODE_LENGTH}
      className="font-mono tracking-[0.2em] uppercase"
    />
  )
}

function AccessCodeDisplay({ code, label = DEFAULT_LABEL }: Omit<AccessCodeDisplayProps, 'mode'>) {
  const [feedback, setFeedback] = useState('')

  async function handleCopy() {
    setFeedback((await copyText(code)) ? COPIED_MESSAGE : COPY_FAILURE_MESSAGE)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <span className="flex-1 font-mono text-2xl tracking-[0.3em] select-all">{code}</span>
        <Button type="button" variant="secondary" onClick={handleCopy}>
          Copiar
        </Button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {feedback}
      </p>
    </div>
  )
}
