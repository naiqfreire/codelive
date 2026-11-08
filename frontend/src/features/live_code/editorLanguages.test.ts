import { describe, expect, it } from 'vitest'
import type { RoomLanguage } from '../rooms'
import { loadLanguageExtension } from './editorLanguages'

const LANGUAGES: RoomLanguage[] = ['python', 'java', 'c', 'php', 'javascript']

describe('loadLanguageExtension', () => {
  it.each(LANGUAGES)('loads a syntax extension for %s', async (language) => {
    const extension = await loadLanguageExtension(language)

    expect(extension).toBeTruthy()
  })

  it('caches the loaded extension per language', () => {
    const first = loadLanguageExtension('python')
    const second = loadLanguageExtension('python')

    expect(second).toBe(first)
  })
})
