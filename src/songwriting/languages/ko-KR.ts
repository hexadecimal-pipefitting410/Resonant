import type { SongSection, SongwritingLanguagePack } from '../types'

const hangulSyllableGlobal = /[\uAC00-\uD7A3]/gu
const hangulJamoGlobal = /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/gu
const latinWord = /[a-z]+/gi
const segmenter = new Intl.Segmenter('ko-KR', { granularity: 'word' })

const medialVowels = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
const finalConsonants = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

function spokenCoda(coda: string) {
  if ('ㄱㄲㄳㄺㅋ'.includes(coda)) return 'ㄱ'
  if ('ㄴㄵㄶ'.includes(coda)) return 'ㄴ'
  if ('ㄷㅅㅆㅈㅊㅌㅎ'.includes(coda)) return 'ㄷ'
  if ('ㄹㄼㄽㄾㅀ'.includes(coda)) return 'ㄹ'
  if ('ㅁㄻ'.includes(coda)) return 'ㅁ'
  if ('ㅂㅄㄿㅍ'.includes(coda)) return 'ㅂ'
  return coda
}

export function koreanTokens(text: string) {
  return [...segmenter.segment(text.normalize('NFC'))]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment.toLocaleLowerCase('ko-KR'))
}

/** Each complete Hangul block normally occupies one sung syllable. */
export function koreanSyllables(raw: string) {
  const normalized = raw.normalize('NFC')
  const hangulBlocks = normalized.match(hangulSyllableGlobal)?.length ?? 0
  const jamo = normalized.match(hangulJamoGlobal)?.length ?? 0
  const latin = normalized.match(latinWord) ?? []
  const latinSyllables = latin.reduce((sum, word) => sum + Math.max(1, word.toLowerCase().match(/[aeiouy]+/g)?.length ?? 1), 0)
  const numericGroups = normalized.match(/\d+/g)?.length ?? 0
  return hangulBlocks + jamo + latinSyllables + numericGroups
}

function hangulRhymeParts(character: string) {
  const offset = character.charCodeAt(0) - 0xAC00
  if (offset < 0 || offset > 11171) return null
  return {
    vowel: medialVowels[Math.floor((offset % 588) / 28)],
    coda: finalConsonants[offset % 28],
  }
}

/** Korean sung rhyme is represented by the final syllable's medial vowel and coda, ignoring its onset. */
export function koreanRhymeKey(raw: string) {
  const lastHangul = [...raw.normalize('NFC')].reverse().find((character) => /[\uAC00-\uD7A3]/u.test(character))
  if (lastHangul) {
    const parts = hangulRhymeParts(lastHangul)
    if (parts) return `${parts.vowel}-${spokenCoda(parts.coda) || '∅'}`
  }
  const word = raw.toLowerCase().replace(/[^a-z]/g, '')
  const match = word.match(/[aeiouy][a-z]*$/)
  return match?.[0] ?? word.slice(-2)
}

function countTerms(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term)).length
}

function koreanReview(draft: { title: string; hook: string; lyrics: string }, sections: SongSection[]) {
  const strengths: string[] = []
  const suggestions: string[] = []
  const hangulCount = draft.lyrics.match(hangulSyllableGlobal)?.length ?? 0
  const latinCount = draft.lyrics.match(/[A-Za-z]/g)?.length ?? 0
  const hookLength = koreanSyllables(draft.hook)
  const hasNativeVerse = sections.some((section) => /벌스|절|랩/.test(section.label))
  const hasNativeChorus = sections.some((section) => /후렴|코러스|훅/.test(section.label))
  const conversational = countTerms(draft.lyrics, ['근데', '사실', '그냥', '아직', '벌써', '왜', '어떻게', '괜찮아', '잠깐', '말해 줘', '있잖아', '그러니까'])
  const clichés = countTerms(draft.lyrics, ['영원', '운명', '별빛', '기적', '세상 끝', '너는 나의 빛', '시간을 되돌려', '심장이 뛰어'])
  const politeEndings = draft.lyrics.match(/(?:요|습니다|습니까|세요)(?:\s|[.!?,…]|$)/gm)?.length ?? 0
  const casualEndings = draft.lyrics.match(/(?:거야|잖아|해|돼|줘|가자|말아|니까)(?:\s|[.!?,…]|$)/gm)?.length ?? 0
  const lineLengths = sections.flatMap((section) => section.lines.map(koreanSyllables)).filter(Boolean)
  const crowdedLines = lineLengths.filter((length) => length > 16).length
  const englishRatio = latinCount / Math.max(1, hangulCount + latinCount)

  if (hasNativeVerse && hasNativeChorus) strengths.push('The lyric uses recognizable Korean production labels, so its performance arc is easy to preserve.')
  if (hookLength >= 3 && hookLength <= 10) strengths.push('The hook is compact enough to chant, repeat, and stage clearly in a K-pop arrangement.')
  if (conversational >= 3) strengths.push('The Korean reads like a speaking voice rather than a literal translation.')
  if (englishRatio >= 0.04 && englishRatio <= 0.3) strengths.push('The Korean–English code-switching is proportionate enough to function as a deliberate color or hook device.')
  if (!hangulCount) suggestions.push('Write the performance lyric in Hangul. Romanization can be an optional pronunciation aid, but it should not replace the sung Korean copy.')
  if (englishRatio > 0.38) suggestions.push('English is starting to displace the Korean voice. Keep code-switches for a clear hook, slogan, rhyme, or character reason instead of scattering stock phrases.')
  if (politeEndings >= 2 && casualEndings >= 2) suggestions.push('The lyric mixes polite and casual speech endings. Choose a relationship and speech level, or make the switch a clearly staged emotional turn.')
  if (hookLength > 13) suggestions.push('Shorten the Korean hook to one easy breath, then move explanation into the surrounding lines.')
  if (clichés >= 4) suggestions.push('Replace several universal K-pop abstractions with a physical action, location, prop, or private detail that belongs only to this narrator.')
  if (crowdedLines >= Math.max(2, Math.ceil(lineLengths.length / 3))) suggestions.push('Several lines exceed sixteen Hangul blocks. Split or simplify them so 받침-heavy words and consonant transitions remain singable.')
  if (!hasNativeChorus) suggestions.push('Tag a clear 후렴 or 코러스 and give it a title-centered payoff; let the 벌스 change scene or information before it returns.')
  return { strengths, suggestions }
}

export const koreanSongwriting: SongwritingLanguagePack = {
  id: 'ko-KR',
  name: 'Korean (K-pop)',
  locale: 'ko-KR',
  aliases: ['ko', 'Korean', 'K-pop', 'Kpop', 'K pop', '한국어', '한국말', '케이팝'],
  description: 'Contemporary Korean songwriting with Hangul-block meter, vowel-and-coda rhyme, purposeful Korean–English code-switching, native production labels, and K-pop performance architecture.',
  templates: [
    { id: 'kpop-performance', name: '퍼포먼스 K-pop', description: 'A full-scale group release with escalating sections, a post-chorus identity, rap contrast, and dedicated dance break.', sections: ['인트로', '벌스 1', '프리코러스', '후렴', '포스트코러스', '벌스 2 / 랩', '프리코러스', '후렴', '댄스 브레이크', '브리지', '마지막 후렴', '아웃트로'] },
    { id: 'kpop-hook-first', name: '훅 퍼스트 K-pop', description: 'Introduces the signature phrase immediately, then earns larger returns through contrast and choreography.', sections: ['인트로 훅', '벌스 1', '프리코러스', '후렴', '포스트코러스', '랩 벌스', '후렴', '브리지', '마지막 후렴', '아웃트로'] },
    { id: 'kpop-rnb', name: 'K-R&B', description: 'Conversational close-up verses, a smooth lift, and a chorus carried by melody rather than constant maximal energy.', sections: ['인트로', '벌스 1', '프리코러스', '후렴', '벌스 2', '후렴', '브리지', '애드리브 후렴', '아웃트로'] },
    { id: 'korean-hip-hop', name: '한국 힙합', description: 'Narrative rap verses with internal rhyme, flow changes, and a compact melodic or chanted hook.', sections: ['인트로', '랩 벌스 1', '훅', '랩 벌스 2', '훅', '스위치업', '마지막 훅', '아웃트로'] },
    { id: 'kpop-band', name: 'K-pop 밴드', description: 'A guitar-and-drum arc with melodic verses, an instrumental release, and a final live-sized chorus.', sections: ['전주', '벌스 1', '프리코러스', '후렴', '벌스 2', '후렴', '간주', '브리지', '마지막 후렴', '후주'] },
    { id: 'korean-ballad', name: '한국 발라드', description: 'A scene-led slow build whose final chorus changes meaning after the bridge revelation.', sections: ['전주', '벌스 1', '벌스 2', '후렴', '간주', '벌스 3', '후렴', '브리지', '마지막 후렴', '후주'] },
  ],
  quickSections: ['벌스', '프리코러스', '후렴', '랩 벌스', '브리지', '댄스 브레이크', '아웃트로'],
  lyricPlaceholder: '[벌스 1]\n구체적인 시간, 장소, 행동으로 장면을 시작하세요…\n\n[프리코러스]\n리듬과 감정의 압력을 올리세요…\n\n[후렴]\n짧고 자연스러운 한국어로 제목과 핵심 약속을 노래하세요…',
  sectionAliases: {
    intro: ['인트로', '도입', '전주', '인트로 훅'],
    verse: ['벌스', '절', '랩 벌스', '랩', '파트'],
    'pre-chorus': ['프리코러스', '프리 코러스', '프리-코러스', '후렴 전'],
    chorus: ['후렴', '코러스', '훅', '마지막 후렴', '애드리브 후렴', '마지막 훅'],
    'post-chorus': ['포스트코러스', '포스트 코러스', '후렴 뒤'],
    bridge: ['브리지', '전환부', '스위치업', '클라이맥스'],
    breakdown: ['댄스 브레이크', '댄스브레이크', '간주', '연주', '브레이크'],
    outro: ['아웃트로', '마무리', '후주'],
  },
  generatorSectionLabels: {
    '인트로': 'Intro', '인트로 훅': 'Intro Hook', '전주': 'Intro',
    '벌스 1': 'Verse 1', '벌스 2': 'Verse 2', '벌스 2 / 랩': 'Rap Verse', '랩 벌스': 'Rap Verse',
    '프리코러스': 'Pre-Chorus', '프리코러스 2': 'Pre-Chorus 2',
    '후렴': 'Chorus', '포스트코러스': 'Post-Chorus', '훅': 'Hook',
    '댄스 브레이크': 'Dance Break', '브리지': 'Bridge', '간주': 'Instrumental',
    '마지막 후렴': 'Final Chorus', '애드리브 후렴': 'Ad-Lib Chorus', '아웃트로': 'Outro', '후주': 'Outro',
  },
  cliches: ['영원히 함께', '운명 같은 사랑', '별빛 아래', '기적 같은 너', '세상 끝까지', '너는 나의 빛', '시간을 되돌려', '심장이 뛰어', '꿈을 향해', '날개를 펼쳐', '이 밤이 끝나기 전에', '불꽃처럼', '미친 듯이', '너밖에 없어'],
  sensoryWords: ['새벽', '지하철', '편의점', '횡단보도', '옥상', '복도', '연습실', '이어폰', '진동', '네온', '형광등', '빗물', '운동화', '립스틱', '재킷', '종이컵', '택시', '골목', '엘리베이터', '향수', '비누', '먼지', '열기', '차가운', '젖은', '눈부신', '웅성임', '숨소리', '발자국', '베이스'],
  tokenize: koreanTokens,
  syllables: koreanSyllables,
  rhymeKey: koreanRhymeKey,
  review: koreanReview,
  coachingGuide: `Write natural contemporary Korean in Hangul. Do not translate English sentence order word for word: Korean can omit an obvious subject, place emotional information late, and let endings carry relationship, certainty, and attitude. Decide who is speaking to whom and keep 반말, 해요체, or a more formal register coherent. A deliberate speech-level switch can reveal intimacy, distance, sarcasm, or a breaking point, but an accidental mixture sounds generated. Romanization may be supplied separately for rehearsal; it is not the performance lyric.

Build one precise song promise and a compact title phrase. In performance-led K-pop, make sections do different jobs: 벌스 establishes character and groove; 프리코러스 narrows the lyric while harmony or register rises; 후렴 states the memorable emotional sentence; 포스트코러스 supplies a chant, motif, or movement identity rather than repeating the entire chorus; 랩 벌스 changes cadence and information; 댄스 브레이크 creates physical release; 브리지 reveals, decides, or strips the track back before the largest final return. Not every song needs every section. K-R&B and ballads should leave more negative space; Korean hip-hop needs point of view, internal rhyme, flow changes, and local detail rather than pop slogans.

Korean–English code-switching is a normal K-pop resource, not a requirement. Use English when it produces a cleaner hook, character voice, rhythmic attack, rhyme, or internationally legible slogan. Make the switch grammatically and emotionally intentional; avoid a random trail of baby, crazy, tonight, forever, and fire. A strong bilingual hook often establishes one phrase and then answers, reframes, or completes it in Korean.

Count each complete Hangul syllable block as one approximate sung beat-unit. Compare neighboring lines for breath and pulse, but allow syncopation and held vowels. 받침 and dense consonant transitions can become unclear on fast passages or exposed high notes, so sing-test them and favor open, sustainable vowels at major melodic peaks when meaning allows. Do not split a grammatical ending from its phrase merely to satisfy a grid.

For rhyme, compare the final syllable's medial vowel and coda rather than its opening consonant. Exact vowel-and-coda matches are strong; related vowel colors, repeated grammatical endings, internal rhyme, alliteration, and rhythmic correspondence can carry looser pop rhyme. In rap, build multi-syllable sound chains and vary line endings. Never force every line to the same ending or repeat filler grammar only to manufacture rhyme.

Prefer contemporary spoken detail—a station exit, practice-room floor, unread vibration, wet cuff, convenience-store light—over a stack of 영원, 운명, 별빛, 기적, and 빛. Give each member or voice a dramatic purpose if parts are assigned. Do not imitate a living artist or reproduce a recognizable topline, lyric, signature ad-lib, or concept. Finish by reading the Korean aloud, clapping the Hangul-block rhythm, checking speech levels and code-switches, then listening to a generated vocal for pronunciation and consonant clarity before approval.`,
}
