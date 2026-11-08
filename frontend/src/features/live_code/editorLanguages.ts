import type { Extension } from '@codemirror/state'
import type { RoomLanguage } from '../rooms'

type LanguageLoader = () => Promise<Extension>

const loaders: Record<RoomLanguage, LanguageLoader> = {
  python: async () => (await import('@codemirror/lang-python')).python(),
  java: async () => (await import('@codemirror/lang-java')).java(),
  c: async () => (await import('@codemirror/lang-cpp')).cpp(),
  php: async () => (await import('@codemirror/lang-php')).php(),
  javascript: async () => (await import('@codemirror/lang-javascript')).javascript(),
}

const cache = new Map<RoomLanguage, Promise<Extension>>()

export function loadLanguageExtension(language: RoomLanguage): Promise<Extension> {
  const cached = cache.get(language)
  if (cached) {
    return cached
  }

  const pending = loaders[language]()
  cache.set(language, pending)
  return pending
}
