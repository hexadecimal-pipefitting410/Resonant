import { getSongwritingLanguage, listSongwritingLanguages } from './registry'
import type { SongSection, SongSectionKind, SongwritingAnalysis, SongwritingDraft, SongwritingLanguagePack } from './types'

const sectionPattern = /^\s*\[([^\]]+)]\s*$/

const generatorTags: Record<Exclude<SongSectionKind, 'other'>, string> = {
  intro: 'Intro', verse: 'Verse', 'pre-chorus': 'Pre-Chorus', chorus: 'Chorus',
  'post-chorus': 'Post-Chorus', bridge: 'Bridge', breakdown: 'Breakdown', outro: 'Outro',
}

function comparableSectionLabel(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('en').replace(/[\p{Pd}_]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

function sectionKind(label: string, language = 'en'): SongSectionKind {
  const value = label.toLowerCase()
  if (value.includes('pre') && value.includes('chorus')) return 'pre-chorus'
  if (value.includes('post') && value.includes('chorus')) return 'post-chorus'
  if (value.includes('chorus') || value.includes('refrain')) return 'chorus'
  if (value.includes('verse')) return 'verse'
  if (value.includes('bridge') || value.includes('middle eight')) return 'bridge'
  if (value.includes('intro')) return 'intro'
  if (value.includes('outro') || value.includes('ending')) return 'outro'
  if (value.includes('break')) return 'breakdown'
  const aliases = getSongwritingLanguage(language).sectionAliases ?? {}
  const comparable = value.replace(/[\p{Pd}_]+/gu, ' ').replace(/\s+/g, ' ').trim()
  for (const [kind, candidates] of Object.entries(aliases) as Array<[SongSectionKind, string[]]>) {
    if (candidates.some((candidate) => comparable.includes(candidate.toLowerCase().replace(/[\p{Pd}_]+/gu, ' ').replace(/\s+/g, ' ').trim()))) return kind
  }
  return 'other'
}

export function parseSongSections(lyrics: string, language = 'en'): SongSection[] {
  const sections: SongSection[] = []
  let current: SongSection = { label: 'Lyrics', kind: 'other', lines: [] }
  for (const raw of lyrics.replace(/\r/g, '').split('\n')) {
    const tag = raw.match(sectionPattern)
    if (tag) {
      if (current.lines.length) sections.push(current)
      current = { label: tag[1].trim(), kind: sectionKind(tag[1], language), lines: [] }
    } else if (raw.trim()) current.lines.push(raw.trim())
  }
  if (current.lines.length || !sections.length) sections.push(current)
  return sections
}

function generatorTagForPack(label: string, pack: SongwritingLanguagePack) {
  const comparable = comparableSectionLabel(label)
  const exact = Object.entries(pack.generatorSectionLabels ?? {}).find(([candidate]) => comparableSectionLabel(candidate) === comparable)?.[1]
  if (exact) return exact
  const kind = sectionKind(label, pack.id)
  if (kind === 'other') return null
  const number = label.match(/\d+/u)?.[0]
  return `${generatorTags[kind]}${number ? ` ${number}` : ''}`
}

/** Translate section-control tags for ACE-Step while leaving every sung lyric line unchanged. */
export function prepareLyricsForGenerator(lyrics: string, language?: string) {
  const packs = language ? [getSongwritingLanguage(language)] : listSongwritingLanguages()
  return lyrics.replace(/^(\s*)\[([^\]]+)]\s*$/gm, (raw, indentation: string, rawLabel: string) => {
    const label = rawLabel.trim()
    if (/^(?:(?:final|rap|dance|instrumental|ad[ -]?lib)\s+)?(?:intro|verse|pre[ -]?chorus|chorus|post[ -]?chorus|bridge|breakdown|outro|hook)(?:\s+\d+)?$/i.test(label)) return raw
    for (const pack of packs) {
      const translated = generatorTagForPack(label, pack)
      if (translated) return `${indentation}[${translated}]`
    }
    return raw
  })
}

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))) }

function languageTokens(pack: SongwritingLanguagePack, text: string) {
  return pack.tokenize?.(text) ?? text.match(/[\p{L}\p{M}\p{N}']+/gu) ?? []
}

export function analyzeSongwriting(draft: Pick<SongwritingDraft, 'language' | 'title' | 'hook' | 'lyrics'>): SongwritingAnalysis {
  const pack = getSongwritingLanguage(draft.language)
  const sections = parseSongSections(draft.lyrics, draft.language)
  const lineFrequency = new Map<string, number>()
  const lineDisplay = new Map<string, string>()
  const lineKinds = new Map<string, SongSectionKind[]>()
  const analyzed = sections.map((section) => {
    const linesAnalysis = section.lines.map((text) => {
      const words = languageTokens(pack, text)
      const lastWord = words.at(-1)?.toLowerCase() ?? ''
      const normalized = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim()
      lineFrequency.set(normalized, (lineFrequency.get(normalized) ?? 0) + 1)
      lineDisplay.set(normalized, text)
      lineKinds.set(normalized, [...(lineKinds.get(normalized) ?? []), section.kind])
      return { text, syllables: words.reduce((sum, word) => sum + pack.syllables(word), 0), lastWord, rhymeKey: pack.rhymeKey(lastWord) }
    })
    const keys: string[] = []
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (const line of linesAnalysis) {
      let index = keys.indexOf(line.rhymeKey)
      if (index < 0) { keys.push(line.rhymeKey); index = keys.length - 1 }
    }
    return { ...section, linesAnalysis, rhymeScheme: linesAnalysis.map((_, index) => alphabet[keys.indexOf(linesAnalysis[index].rhymeKey)] ?? '?').join('') }
  })
  const allLines = analyzed.flatMap((section) => section.linesAnalysis)
  const words = languageTokens(pack, draft.lyrics.toLowerCase())
  const repeatedLines = [...lineFrequency.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0)
  const detectedHookKey = [...lineFrequency.entries()].filter(([line, count]) => count > 1 && line.length >= 3 && line.length <= 90).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] ?? ''
  const detectedHook = detectedHookKey ? lineDisplay.get(detectedHookKey) ?? null : null
  const kinds = new Set(sections.map((section) => section.kind))
  const structure = clamp((kinds.has('verse') ? 35 : 0) + (kinds.has('chorus') ? 40 : 0) + (kinds.has('bridge') || kinds.has('pre-chorus') ? 15 : 0) + (sections.length >= 4 ? 10 : sections.length * 2))
  const normalizedLyrics = draft.lyrics.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
  const suppliedHook = draft.hook.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim()
  const normalizedHook = suppliedHook || detectedHookKey
  const hookOccurrences = normalizedHook ? normalizedLyrics.split(normalizedHook).length - 1 : 0
  const hook = clamp((suppliedHook ? 25 : detectedHookKey ? 15 : 0) + Math.min(60, hookOccurrences * 20) + (draft.title && normalizedHook.includes(draft.title.toLowerCase()) ? 15 : 0))
  const usefulLines = allLines.filter((line) => line.syllables > 0)
  const inRange = usefulLines.filter((line) => line.syllables >= 4 && line.syllables <= 14).length
  const sectionSpreads = analyzed.filter((section) => section.linesAnalysis.length > 1).map((section) => Math.max(...section.linesAnalysis.map((line) => line.syllables)) - Math.min(...section.linesAnalysis.map((line) => line.syllables)))
  const singability = clamp((usefulLines.length ? inRange / usefulLines.length * 70 : 0) + (sectionSpreads.length ? sectionSpreads.filter((spread) => spread <= 5).length / sectionSpreads.length * 30 : 0))
  const sensoryHits = words.filter((word) => pack.sensoryWords.includes(word)).length
  const imagery = clamp(Math.min(100, sensoryHits * 12 + new Set(words).size / Math.max(1, words.length) * 30))
  const clicheHits = pack.cliches.filter((phrase) => normalizedLyrics.includes(phrase)).length
  const narrativeKinds = new Set<SongSectionKind>(['verse', 'bridge', 'other'])
  const hookRepetitions = Math.max(0, (lineFrequency.get(normalizedHook) ?? 1) - 1)
  const intentionalRepeatedLines = [...lineFrequency.entries()].filter(([line, count]) => count > 1 && (line === normalizedHook || (lineKinds.get(line) ?? []).every((kind) => !narrativeKinds.has(kind)))).reduce((sum, [, count]) => sum + count - 1, 0)
  const unintentionalRepeatedLines = Math.max(0, repeatedLines - intentionalRepeatedLines)
  const originalityLines = [...new Set(analyzed.flatMap((section) => section.linesAnalysis.map((line) => line.text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}']+/gu, ' ').trim())))]
  const originalityWords = originalityLines.join(' ').match(/[\p{L}\p{M}\p{N}']+/gu) ?? []
  const uniqueRatio = new Set(originalityWords).size / Math.max(1, originalityWords.length)
  const originality = clamp(uniqueRatio * 52 + 48 - clicheHits * 14 - unintentionalRepeatedLines * 8)
  const strengths: string[] = [], suggestions: string[] = []
  if (structure >= 80) strengths.push('The form has clear sections and useful contrast points.')
  else suggestions.push('Give the song a clear verse/chorus form and add a bridge or pre-chorus only when it changes the emotional pressure.')
  if (hook >= 70) strengths.push('The central hook returns enough to feel intentional.')
  else suggestions.push(suppliedHook ? 'Repeat or vary the hook at the chorus payoff so the title becomes memorable.' : detectedHook ? `“${detectedHook}” reads like the emerging hook. Confirm it in Song DNA or sharpen it into the title payoff.` : 'Write one short hook that states the song’s central promise in conversational language.')
  if (singability >= 75) strengths.push('Most lines sit in a singable syllable range with controlled variation.')
  else suggestions.push('Read each section aloud over a steady pulse; shorten crowded lines and strengthen stressed words.')
  if (imagery >= 55) strengths.push('Concrete sensory language gives the lyric a visible world.')
  else suggestions.push('Replace one abstract claim per verse with a place, object, action, sound, texture, taste, or physical consequence.')
  if (clicheHits) suggestions.push(`Rework ${clicheHits} familiar phrase${clicheHits === 1 ? '' : 's'} so the language belongs to this specific narrator.`)
  if (!kinds.has('bridge')) suggestions.push('Optional: use a bridge only if it reveals, decides, or reframes something the verses could not.')
  const languageReview = pack.review?.(draft, sections)
  if (languageReview) {
    strengths.push(...languageReview.strengths.filter((strength) => !strengths.includes(strength)))
    suggestions.push(...languageReview.suggestions.filter((suggestion) => !suggestions.includes(suggestion)))
  }
  return {
    language: pack.id, detectedHook, sections: analyzed,
    scores: { overall: clamp((structure + hook + singability + imagery + originality) / 5), structure, hook, singability, imagery, originality },
    counts: { sections: sections.length, lines: allLines.length, words: words.length, repeatedLines, hookRepetitions, intentionalRepeatedLines, unintentionalRepeatedLines }, strengths, suggestions,
  }
}

export function emptySongwritingDraft(language = 'en'): SongwritingDraft {
  return { language: getSongwritingLanguage(language).id, title: '', idea: '', hook: '', pointOfView: 'first-person', tense: 'present', mood: '', genre: '', audience: '', imagery: '', stylePrompt: '', lyrics: '' }
}

export function applyStructureTemplate(draft: SongwritingDraft, templateId: string) {
  const pack = getSongwritingLanguage(draft.language)
  const template = pack.templates.find((candidate) => candidate.id === templateId)
  if (!template) throw new Error(`Unknown ${pack.name} song structure: ${templateId}`)
  const existing = new Map(parseSongSections(draft.lyrics, draft.language).map((section) => [section.label.toLowerCase(), section.lines]))
  const lyrics = template.sections.map((label) => `[${label}]\n${existing.get(label.toLowerCase())?.join('\n') ?? ''}`).join('\n\n')
  return { ...draft, lyrics }
}

export function buildSongwritingPrompt(draft: SongwritingDraft) {
  const pack = getSongwritingLanguage(draft.language)
  return `Write an original ${pack.name} song.\n\nTITLE OR WORKING TITLE: ${draft.title || '(discover a strong title)'}\nCORE IDEA: ${draft.idea || '(develop from context)'}\nCENTRAL HOOK: ${draft.hook || '(invent a concise hook)'}\nGENRE: ${draft.genre || 'choose an appropriate contemporary form'}\nMOOD: ${draft.mood || 'emotionally specific'}\nPOINT OF VIEW: ${draft.pointOfView}\nTENSE: ${draft.tense}\nAUDIENCE / SITUATION: ${draft.audience || '(unspecified)'}\nIMAGE BANK: ${draft.imagery || '(invent concrete, coherent imagery)'}\nPRODUCTION DIRECTION: ${draft.stylePrompt || '(support the lyric’s emotional arc)'}\n\nCRAFT STANDARD:\n${pack.coachingGuide}\n\nReturn: (1) title, (2) one-sentence song promise, (3) section-tagged lyrics, (4) concise style prompt for a music generator, and (5) three brief revision notes. Do not imitate a living artist or reuse recognizable lyrics.`
}
