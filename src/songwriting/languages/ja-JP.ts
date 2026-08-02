import type { SongSection, SongwritingLanguagePack } from '../types'

const segmenter = new Intl.Segmenter('ja-JP', { granularity: 'word' })
const kanaPattern = /[\u3040-\u30FF]/u
const kanaGlobal = /[\u3040-\u30FF]/gu
const hanGlobal = /\p{Script=Han}/gu
const smallKana = 'ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ'

export function japaneseTokens(text: string) {
  return [...segmenter.segment(text.normalize('NFKC'))]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment.toLocaleLowerCase('ja-JP'))
}

function kanaMoras(raw: string) {
  const moras: string[] = []
  for (const character of raw.normalize('NFKC')) {
    if (!kanaPattern.test(character)) continue
    if (smallKana.includes(character) && moras.length) moras[moras.length - 1] += character
    else moras.push(character)
  }
  return moras
}

/** Counts Japanese morae: contracted small kana attach, while っ, ん, and ー each occupy one beat. */
export function japaneseMoras(raw: string) {
  const normalized = raw.normalize('NFKC')
  const kanaCount = kanaMoras(normalized).length
  const hanCount = normalized.match(hanGlobal)?.length ?? 0
  const latinWords = normalized.match(/[a-z]+/gi) ?? []
  const latinCount = latinWords.reduce((sum, word) => sum + Math.max(1, word.toLowerCase().match(/[aeiouy]+/g)?.length ?? 1), 0)
  const numericGroups = normalized.match(/\d+/g)?.length ?? 0
  return kanaCount + hanCount + latinCount + numericGroups
}

function hiragana(character: string) {
  const code = character.charCodeAt(0)
  return code >= 0x30A1 && code <= 0x30F6 ? String.fromCharCode(code - 0x60) : character
}

function moraVowel(mora: string, previous = '') {
  const value = [...mora].map(hiragana).join('')
  if (value === 'ー') return previous || 'ー'
  if (value === 'ん') return 'n'
  if (value === 'っ') return 'q'
  const last = value.at(-1) ?? ''
  if ('ぁあかがさざただなはばぱまゃやらゎわ'.includes(last)) return 'a'
  if ('ぃいきぎしじちぢにひびぴみりゐ'.includes(last)) return 'i'
  if ('ぅうくぐすずつづぬふぶぷむゅゆるゔ'.includes(last)) return 'u'
  if ('ぇえけげせぜてでねへべぺめれゑ'.includes(last)) return 'e'
  if ('ぉおこごそぞとどのほぼぽもょよろを'.includes(last)) return 'o'
  return last
}

/** Returns a two-mora vowel/coda tail; Japanese pop rhyme often follows vowel color and mora rhythm. */
export function japaneseRhymeKey(raw: string) {
  const moras = kanaMoras(raw)
  if (moras.length) {
    const sounds: string[] = []
    for (const mora of moras) sounds.push(moraVowel(mora, sounds.at(-1)))
    return sounds.slice(-2).join('-')
  }
  const lastHan = (raw.match(hanGlobal) ?? []).at(-1)
  if (lastHan) return lastHan
  const word = raw.toLowerCase().replace(/[^a-z]/g, '')
  const match = word.match(/[aeiouy][a-z]*$/)
  return match?.[0] ?? word.slice(-2)
}

function countTerms(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term)).length
}

function japaneseReview(draft: { title: string; hook: string; lyrics: string }, sections: SongSection[]) {
  const strengths: string[] = []
  const suggestions: string[] = []
  const japaneseCharacters = (draft.lyrics.match(kanaGlobal)?.length ?? 0) + (draft.lyrics.match(hanGlobal)?.length ?? 0)
  const latinCharacters = draft.lyrics.match(/[A-Za-z]/g)?.length ?? 0
  const hookMoras = japaneseMoras(draft.hook)
  const hasNativeVerse = sections.some((section) => /Aメロ|Ａメロ|ヴァース/.test(section.label))
  const hasNativeChorus = sections.some((section) => /サビ|コーラス/.test(section.label))
  const conversational = countTerms(draft.lyrics, ['でも', 'だって', 'ねえ', 'ほら', 'まだ', 'もう', 'なんで', '大丈夫', 'ちょっと', 'ほんとは', 'じゃあ', '待って'])
  const clichés = countTerms(draft.lyrics, ['永遠', '運命', '奇跡', '星空', '翼を広げ', '君は光', '世界の果て', '時を戻し', '夢を追いかけ'])
  const politeEndings = draft.lyrics.match(/(?:です|ます|ません|でした|ました)(?:\s|[。！？，、…]|$)/gm)?.length ?? 0
  const plainEndings = draft.lyrics.match(/(?:だよ|だね|じゃん|んだ|てる|ない|たい|よ|ね)(?:\s|[。！？，、…]|$)/gm)?.length ?? 0
  const firstPersons = ['私', 'わたし', '僕', 'ぼく', '俺', 'おれ', 'あたし'].filter((term) => draft.lyrics.includes(term))
  const lineLengths = sections.flatMap((section) => section.lines.map(japaneseMoras)).filter(Boolean)
  const crowdedLines = lineLengths.filter((length) => length > 20).length
  const englishRatio = latinCharacters / Math.max(1, japaneseCharacters + latinCharacters)

  if (hasNativeVerse && hasNativeChorus) strengths.push('The lyric uses the Aメロ/Bメロ/サビ vocabulary expected in Japanese pop production.')
  if (hookMoras >= 4 && hookMoras <= 14) strengths.push('The hook occupies a practical mora range for a memorable Japanese melodic phrase.')
  if (conversational >= 3) strengths.push('The Japanese voice feels conversational rather than mechanically translated.')
  if (!japaneseCharacters) suggestions.push('Write the performance lyric in Japanese script. Rōmaji can be a separate rehearsal aid, but should not replace the sung copy.')
  if (englishRatio > 0.32) suggestions.push('English is displacing the Japanese voice. Keep it for a deliberate title, hook, image, rhyme, or character reason instead of ornamental fragments.')
  if (politeEndings >= 2 && plainEndings >= 2) suggestions.push('The lyric mixes polite です／ます endings with plain or intimate speech. Choose a narrator relationship, or stage the register change as part of the story.')
  if (firstPersons.length > 1) suggestions.push(`The narrator uses multiple first-person identities (${firstPersons.join('、')}). Choose one voice unless a character or perspective change is explicit.`)
  if (hookMoras > 18) suggestions.push('Shorten the サビ hook to a clean mora phrase and let the surrounding lines explain its meaning.')
  if (clichés >= 4) suggestions.push('The lyric leans on familiar J-pop abstractions. Replace several with a mundane object, small action, season-specific texture, or exact place.')
  if (crowdedLines >= Math.max(2, Math.ceil(lineLengths.length / 3))) suggestions.push('Several lines exceed twenty estimated morae. Split them or reserve the density for a deliberate rapid passage; long vowels, っ, and ん still require time.')
  if (!hasNativeChorus) suggestions.push('Tag a clear サビ and give it a title-centered melodic payoff; use Aメロ and Bメロ to change information and pressure before each return.')
  return { strengths, suggestions }
}

export const japaneseSongwriting: SongwritingLanguagePack = {
  id: 'ja-JP',
  name: 'Japanese (J-pop)',
  locale: 'ja-JP',
  aliases: ['ja', 'Japanese', 'J-pop', 'Jpop', 'J pop', '日本語', 'にほんご', 'ジェイポップ'],
  description: 'Contemporary Japanese songwriting with mora-aware meter, vowel-pattern rhyme, Aメロ/Bメロ/サビ structure, script and register coaching, and specialized J-pop, anime, city-pop, rock, idol, and ballad forms.',
  templates: [
    { id: 'jpop-standard', name: '王道J-pop', description: 'The classic Aメロ–Bメロ–サビ climb, repeated with new information and resolved through a Cメロ before the final chorus.', sections: ['イントロ', 'Aメロ 1', 'Bメロ 1', 'サビ', 'Aメロ 2', 'Bメロ 2', 'サビ', '間奏', 'Cメロ', 'ラスサビ', 'アウトロ'] },
    { id: 'anime-opening', name: 'アニメ・オープニング', description: 'A compact, image-rich launch with an immediate motif, fast setup, lift, and decisive chorus suitable for a 90-second edit.', sections: ['イントロ・フック', 'Aメロ', 'Bメロ', 'サビ', '短い間奏', 'ラスサビ', 'エンディング'] },
    { id: 'city-pop', name: 'シティポップ', description: 'Urban snapshots, sophisticated groove, and a chorus that opens emotionally without abandoning conversational restraint.', sections: ['イントロ', 'Aメロ 1', 'Bメロ', 'サビ', 'Aメロ 2', 'サビ', 'インスト', 'Cメロ', 'ラスサビ', 'アウトロ'] },
    { id: 'jrock-band', name: 'J-rock / バンド', description: 'Tight verse momentum, a wide vocal chorus, an instrumental peak, and a final live-sized release.', sections: ['イントロ', 'Aメロ 1', 'Bメロ', 'サビ', 'Aメロ 2', 'サビ', 'ギターソロ', 'Cメロ', '落ちサビ', 'ラスサビ', 'アウトロ'] },
    { id: 'idol-call-response', name: 'アイドル・コール＆レスポンス', description: 'Clear character lines, fan-answer pockets, a slogan-like chorus, and a staged dance break without sacrificing story.', sections: ['イントロ', 'Aメロ / メンバー紹介', 'Bメロ', 'サビ', 'コール＆レスポンス', 'Aメロ 2', 'サビ', 'ダンスブレイク', 'Cメロ', 'ラスサビ', 'アウトロ'] },
    { id: 'japanese-ballad', name: 'J-pop バラード', description: 'Patient scene-building and restrained verses that earn a changed, vocally open final chorus.', sections: ['前奏', 'Aメロ 1', 'Aメロ 2', 'Bメロ', 'サビ', '間奏', 'Aメロ 3', 'サビ', 'Cメロ', 'ラスサビ', '後奏'] },
  ],
  quickSections: ['Aメロ', 'Bメロ', 'サビ', 'Cメロ', '間奏', '落ちサビ', 'ラスサビ', 'アウトロ'],
  lyricPlaceholder: '[Aメロ 1]\n時間、場所、小さな動作から場面を始める…\n\n[Bメロ]\n言葉を絞りながら感情と音域を上げる…\n\n[サビ]\n自然な日本語でタイトルと心の答えを歌う…',
  sectionAliases: {
    intro: ['イントロ', '前奏', 'イントロ・フック', '導入'],
    verse: ['Aメロ', 'Ａメロ', 'Aメロディ', 'ヴァース', 'Aメロ / メンバー紹介'],
    'pre-chorus': ['Bメロ', 'Ｂメロ', 'Bメロディ', 'プレコーラス'],
    chorus: ['サビ', 'コーラス', 'ラスサビ', '大サビ', '落ちサビ'],
    'post-chorus': ['ポストコーラス', '後サビ', 'リフレイン'],
    bridge: ['Cメロ', 'Ｃメロ', 'ブリッジ', '転調部'],
    breakdown: ['間奏', '短い間奏', 'インスト', 'ギターソロ', 'ダンスブレイク', 'コール＆レスポンス'],
    outro: ['アウトロ', '後奏', 'エンディング', '締め'],
  },
  cliches: ['永遠に', '運命の人', '奇跡みたい', '星空の下', '翼を広げ', '君は僕の光', '世界の果てまで', '時を戻して', '夢を追いかけ', '涙の数だけ', '明日へ走る', '心の扉', '消えない想い', '桜が舞う'],
  sensoryWords: ['始発', '終電', '改札', 'ホーム', '踏切', '商店街', 'コンビニ', '屋上', '歩道橋', '教室', '廊下', '自販機', '通知', 'イヤホン', '傘', '制服', '袖口', '紙コップ', 'ラムネ', '潮風', '雨粒', '蝉', '蛍光灯', 'ネオン', 'アスファルト', '石けん', '冷たい', '湿った', 'まぶしい', 'ざわめき', '足音', '息'],
  tokenize: japaneseTokens,
  syllables: japaneseMoras,
  rhymeKey: japaneseRhymeKey,
  review: japaneseReview,
  coachingGuide: `Write natural contemporary Japanese in Japanese script. Do not translate English syntax or repeat pronouns mechanically: Japanese often omits information already recoverable from context, places the decisive predicate late, and uses particles and endings to control distance, certainty, gendered styling, and emotional temperature. Choose a narrator voice—私, 僕, 俺, あたし, or a mostly omitted first person—and keep it intentional. Keep plain speech and です／ます speech coherent unless the change marks social distance or an emotional turn. Rōmaji may appear as a separate rehearsal guide, never as the primary performance lyric.

Use the Japanese production vocabulary as musical functions, not mandatory boxes. Aメロ establishes scene, rhythm, and point of view; Bメロ changes harmonic or melodic pressure and narrows the words; サビ delivers the title, widest melodic identity, and emotional answer. Cメロ must reveal, contradict, decide, or change perspective. 落ちサビ is a reduced or exposed chorus that changes intimacy; ラスサビ is the final expanded return. A strong anime opening still needs a human want beneath its kinetic imagery. City pop benefits from precise urban time, objects, and adult restraint. Idol writing needs distinct voices and real response pockets rather than generic cheerfulness. J-rock needs consonant energy and band dynamics but still has to leave vowels for the vocal peak.

Measure Japanese in morae (拍), not English-style syllables. A normal kana occupies one mora; contracted sounds such as きゃ form one mora together, while っ, ん, and the long-vowel mark ー each take their own time. Written kanji does not reveal its reading, so the analyzer treats each kanji as a conservative one-mora fallback; the writer must count the intended reading aloud. Preserve long vowels and small っ because changing their duration can change the word. Compare neighboring lines for pulse without forcing identical counts, and make room for breath after dense particle and ending chains.

Japanese pop rhyme is often lighter than English rhyme. Build cohesion through final vowel sequences, matching mora counts, repeated grammatical frames, internal echo, alliteration, and strategically repeated keywords. Exact endings can work, but do not attach the same 〜てる, 〜ない, or 〜たい ending to every line just to simulate rhyme. Favor open vowels on sustained or high notes when meaning allows. Spoken pitch accent does not have to map mechanically onto sung pitch, but crucial names, ambiguous words, long vowels, and exposed phrases must remain intelligible; listen to the rendered vocal rather than trusting the page.

English code-switching and katakana imagery are valid J-pop colors, not automatic signs of modernity. Use English for a title, hook, rhythmic texture, character voice, or meaningful contrast, and check that the phrase is natural enough for its intended audience. Prefer concrete seasonal and everyday detail—last-train air, a wet cuff, vending-machine light, cicadas behind a voicemail—over a stack of 永遠, 運命, 奇跡, 翼, 光, and 世界. Do not imitate a living artist, anime franchise, Vocaloid producer, idol group, or recognizable theme song. Finish by reading the Japanese aloud, counting morae with taps, checking script, particles, register, and long/short sounds, then listening to a generated vocal for diction before approval.`,
}
