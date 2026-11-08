import { useId } from 'react'
import { LANGUAGE_OPTIONS } from '../languages'
import type { RoomLanguage } from '../languages'

type LanguageSelectorProps = {
  value: RoomLanguage
  onChange: (language: RoomLanguage) => void
  disabled?: boolean
  label?: string
  hint?: string
}

export function LanguageSelector({
  value,
  onChange,
  disabled = false,
  label = 'Linguagem',
  hint,
}: LanguageSelectorProps) {
  const generatedId = useId()
  const selectId = generatedId
  const hintId = `${selectId}-hint`

  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(event) => onChange(event.target.value as RoomLanguage)}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        className={[
          'min-h-11 w-full cursor-pointer rounded-lg border border-border bg-surface px-3 font-mono text-foreground',
          'transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
        ].join(' ')}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
