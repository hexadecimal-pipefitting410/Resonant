import { englishSongwriting } from './languages/en'
import { latinSpanishSongwriting } from './languages/es-419'
import { hindiSongwriting } from './languages/hi'
import { japaneseSongwriting } from './languages/ja-JP'
import { koreanSongwriting } from './languages/ko-KR'
import { mandarinSongwriting } from './languages/zh-CN'
import type { SongwritingLanguagePack } from './types'

const packs = new Map<string, SongwritingLanguagePack>()

export function registerSongwritingLanguage(pack: SongwritingLanguagePack) {
  if (!/^[a-z]{2,3}(?:-(?:[A-Z]{2}|\d{3}))?$/.test(pack.id)) throw new Error(`Invalid songwriting language ID: ${pack.id}`)
  if (packs.has(pack.id)) throw new Error(`Songwriting language is already registered: ${pack.id}`)
  packs.set(pack.id, pack)
}

registerSongwritingLanguage(englishSongwriting)
registerSongwritingLanguage(hindiSongwriting)
registerSongwritingLanguage(mandarinSongwriting)
registerSongwritingLanguage(koreanSongwriting)
registerSongwritingLanguage(latinSpanishSongwriting)
registerSongwritingLanguage(japaneseSongwriting)

function languageKey(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/[\s_]+/g, '-')
}

export function getSongwritingLanguage(id = 'en') {
  const requested = languageKey(id)
  const pack = packs.get(id) ?? [...packs.values()].find((candidate) =>
    [candidate.id, candidate.locale, candidate.name, ...(candidate.aliases ?? [])].some((name) => languageKey(name) === requested),
  )
  if (!pack) throw new Error(`Songwriting language '${id}' is not installed. Available: ${[...packs.values()].map((candidate) => `${candidate.id} (${candidate.name})`).join(', ')}.`)
  return pack
}

export function listSongwritingLanguages() {
  return [...packs.values()]
}
