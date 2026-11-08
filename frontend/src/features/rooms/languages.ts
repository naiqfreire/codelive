export const LANGUAGES = ['python', 'java', 'c', 'php', 'javascript'] as const

export type RoomLanguage = (typeof LANGUAGES)[number]

export type LanguageOption = {
  value: RoomLanguage
  label: string
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'php', label: 'PHP' },
  { value: 'javascript', label: 'JavaScript' },
]
