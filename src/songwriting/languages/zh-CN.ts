import { pinyin } from 'pinyin-pro'
import type { SongSection, SongwritingLanguagePack } from '../types'

const hanPattern = /\p{Script=Han}/u
const hanGlobal = /\p{Script=Han}/gu
const latinWord = /[a-z]+/gi
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })

function hanCharacters(text: string) {
  return text.match(hanGlobal) ?? []
}

export function mandarinTokens(text: string) {
  return [...segmenter.segment(text.normalize('NFC'))]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment.toLowerCase())
}

/** Mandarin Hanzi normally map one written character to one sung syllable. */
export function mandarinSyllables(raw: string) {
  const han = hanCharacters(raw).length
  const latin = raw.match(latinWord) ?? []
  const latinSyllables = latin.reduce((sum, word) => sum + Math.max(1, word.toLowerCase().match(/[aeiouy]+/g)?.length ?? 1), 0)
  const numericGroups = raw.match(/\d+/g)?.length ?? 0
  return han + latinSyllables + numericGroups
}

/** Return the Standard Mandarin final (韵母), ignoring lexical tone. */
export function mandarinRhymeKey(raw: string) {
  const lastHan = [...raw.normalize('NFC')].reverse().find((character) => hanPattern.test(character))
  if (lastHan) {
    const final = pinyin(lastHan, { pattern: 'final', toneType: 'none', type: 'array', traditional: true }).at(-1) ?? ''
    return final.replace(/v/g, 'ü')
  }
  const word = raw.toLowerCase().replace(/[^a-z]/g, '')
  const match = word.match(/[aeiouy][a-z]*$/)
  return match?.[0] ?? word.slice(-2)
}

function includesAny(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term)).length
}

function mandarinReview(draft: { title: string; hook: string; lyrics: string }, sections: SongSection[]) {
  const strengths: string[] = []
  const suggestions: string[] = []
  const hanCount = hanCharacters(draft.lyrics).length
  const latinCount = draft.lyrics.match(/[A-Za-z]/g)?.length ?? 0
  const hookLength = hanCharacters(draft.hook).length
  const hasNativeVerse = sections.some((section) => /主歌|說唱段|说唱段/.test(section.label))
  const hasNativeChorus = sections.some((section) => /副歌|疊句|叠句/.test(section.label))
  const conversational = includesAny(draft.lyrics, ['其实', '原来', '还是', '别', '就', '吧', '呢', '吗', '怎么', '为什么', '没关系', '算了', '等一下', '告诉我'])
  const literary = includesAny(draft.lyrics, ['红尘', '浮生', '此生', '宿命', '轮回', '苍穹', '凡尘', '执念', '相思', '彼岸', '风华', '流年', '天涯'])
  const traditionalMarkers = includesAny(draft.lyrics, ['愛', '夢', '風', '聲', '時', '會', '這', '個', '還', '裡', '為', '讓', '說', '聽', '見', '與', '從'])
  const usesNi = /你/.test(draft.lyrics)
  const usesNin = /您/.test(draft.lyrics)
  const lineLengths = sections.flatMap((section) => section.lines.map((line) => mandarinSyllables(line))).filter(Boolean)
  const crowdedLines = lineLengths.filter((length) => length > 14).length

  if (hasNativeVerse && hasNativeChorus) strengths.push('The lyric uses clear Mandarin pop section labels, so a writer or generator can preserve the intended form.')
  if (hookLength >= 4 && hookLength <= 10) strengths.push('The central hook is compact enough to repeat and remember in Mandarin.')
  if (conversational >= 3) strengths.push('Conversational Mandarin keeps the singer close to a speaking voice instead of drifting into translated prose.')
  if (!hanCount) suggestions.push('Write the performance lyric in Chinese characters. Pinyin can be supplied as a pronunciation guide, but should not replace the sung lyric.')
  if (hanCount && latinCount / Math.max(1, hanCount) > 0.18) suggestions.push('Keep English code-switching intentional and sparse; Mandarin should remain the grammatical and emotional base unless the character genuinely speaks otherwise.')
  if (traditionalMarkers >= 3) suggestions.push('This pack targets Simplified Chinese (zh-CN). Keep one script consistently, or use a future Traditional Chinese regional pack for a Taiwan/Hong Kong-specific release.')
  if (usesNi && usesNin) suggestions.push('Choose either 你 or the respectful 您 for the relationship, unless the switch marks a deliberate change in distance or irony.')
  if (hookLength > 12) suggestions.push('Shorten the Mandarin hook to one breath—often four to ten characters—and let the surrounding lines carry the explanation.')
  if (literary >= 4) suggestions.push('The lyric is accumulating classical abstractions. Unless this is deliberately 国风, trade several of them for present-day speech, a physical action, and one specific place or object.')
  if (crowdedLines >= Math.max(2, Math.ceil(lineLengths.length / 3))) suggestions.push('Several lines exceed fourteen sung syllables. Shorten or split them so multi-character words remain intact and the vocalist has room to phrase clearly.')
  if (!hasNativeChorus) suggestions.push('Give the song a clearly tagged 副歌 with a short title payoff; the 主歌 should change the scene or stakes before each return.')
  return { strengths, suggestions }
}

export const mandarinSongwriting: SongwritingLanguagePack = {
  id: 'zh-CN',
  name: 'Mandarin Chinese (Simplified)',
  locale: 'zh-CN',
  aliases: ['zh', 'zh-Hans', 'Chinese', 'Mandarin', 'Mandarin Chinese', 'Standard Chinese', 'Putonghua', '普通话', '普通話', '中文', '华语', '華語', '国语', '國語'],
  description: 'Contemporary Standard Mandarin songwriting in Simplified Chinese, with Hanzi syllable counting, Pinyin-final rhyme, native section labels, conversational-register coaching, and soft tone–melody guidance.',
  templates: [
    { id: 'mandopop-modern', name: '当代华语流行', description: 'Narrative verses, a rising pre-chorus, and a concise title-centered chorus.', sections: ['主歌 1', '预副歌', '副歌', '主歌 2', '预副歌', '副歌', '桥段', '最后副歌', '尾声'] },
    { id: 'mandopop-ballad', name: '叙事抒情', description: 'A slower scene-led ballad whose repeated chorus gains a changed meaning.', sections: ['前奏', '主歌 1', '主歌 2', '副歌', '间奏', '主歌 3', '副歌', '桥段', '最后副歌', '尾声'] },
    { id: 'short-hook-pop', name: '短篇强钩子流行', description: 'A compact streaming form with an early hook and a contrasting bridge.', sections: ['引子', '主歌', '预副歌', '副歌', '主歌 2', '副歌', '桥段', '最后副歌'] },
    { id: 'mandarin-hip-hop', name: '华语说唱', description: 'Dense narrative bars, internal rhyme, a memorable refrain, and space for flow changes.', sections: ['引子', '说唱段 1', '副歌', '说唱段 2', '副歌', '变奏段', '最后副歌', '尾声'] },
    { id: 'guofeng-fusion', name: '国风融合', description: 'Modern pop structure with a controlled traditional image system rather than pseudo-classical word salad.', sections: ['引子', '主歌 1', '副歌', '间奏', '主歌 2', '副歌', '桥段', '最后副歌', '尾声'] },
    { id: 'mandarin-duet', name: '对唱', description: 'Alternating viewpoints that converge in a shared chorus and final decision.', sections: ['甲·主歌', '乙·主歌', '合·副歌', '甲·主歌 2', '乙·主歌 2', '合·副歌', '对话桥段', '最后副歌'] },
  ],
  quickSections: ['主歌', '预副歌', '副歌', '桥段', '尾声'],
  lyricPlaceholder: '[主歌 1]\n从一个具体时间、地点或动作开始…\n\n[副歌]\n用简短自然的普通话唱出标题和核心承诺…',
  sectionAliases: {
    intro: ['引子', '前奏', '开场', '開場'],
    verse: ['主歌', '说唱段', '說唱段', '甲·主歌', '乙·主歌'],
    'pre-chorus': ['预副歌', '預副歌', '导歌', '導歌'],
    chorus: ['副歌', '叠句', '疊句', '合·副歌', '高潮'],
    'post-chorus': ['后副歌', '後副歌'],
    bridge: ['桥段', '橋段', '过渡段', '過渡段', '变奏段', '變奏段', '对话桥段', '對話橋段'],
    breakdown: ['间奏', '間奏', '器乐段', '器樂段'],
    outro: ['尾声', '尾聲', '结尾', '結尾', '收束'],
  },
  cliches: ['人海茫茫', '星辰大海', '命中注定', '地老天荒', '海枯石烂', '心碎成片', '回到从前', '爱到永远', '孤单的夜', '无尽等待', '风吹散回忆', '雨落在心里', '时间会证明', '你是我的光', '世界尽头'],
  sensoryWords: ['凌晨', '地铁', '站台', '巷口', '路灯', '窗台', '楼梯', '厨房', '钥匙', '手机', '外套', '雨伞', '车票', '茶', '咖啡', '烟', '风', '雨', '雪', '潮湿', '冰冷', '温热', '刺眼', '安静', '回声', '脚步', '霓虹', '灰尘', '木头', '铁门', '海盐', '柑橘'],
  tokenize: mandarinTokens,
  syllables: mandarinSyllables,
  rhymeKey: mandarinRhymeKey,
  review: mandarinReview,
  coachingGuide: `Write in natural contemporary Standard Mandarin using Simplified Chinese. Treat “Chinese” as zh-CN unless the user explicitly asks for Cantonese, Taiwanese Mandarin conventions, Hokkien, or another language variety; those require a different pack. Do not translate English syntax word for word. Mandarin may omit an obvious subject, prefers compact verb-led clauses, and often gains emotional force from what is left unsaid. Use Pinyin only as an optional pronunciation annotation, never as the primary performance lyric.

Build one clear song promise and a short title-centered hook. Four to ten Hanzi is a useful starting range, not a law. In contemporary Mandopop, let each 主歌 establish a specific moment and advance the relationship; use 预副歌 only to increase pressure; make 副歌 deliver the plain emotional sentence listeners can sing back. A 桥段 must reveal, choose, contradict, or change distance. For a ballad, change the meaning of the last chorus rather than merely making it louder. For Mandarin rap, use internal and multisyllabic rhyme, cadence changes, and concrete local detail; do not force every bar into the same final. For 国风融合, choose one coherent historical or natural image system and anchor it to a modern human want—do not stack 红尘、宿命、天涯 and other classical-looking nouns without narrative logic. For a duet, make the two voices disagree or hold different information before they converge.

Count Hanzi as approximate sung syllables: one character usually occupies one syllable, but preserve multi-character words across musical phrase boundaries. Keep neighboring lines compatible in breath and character count without making them mechanically identical. Rhyme by the Pinyin final (韵母), normally ignoring tone; vary exact and family rhymes so meaning remains natural. Avoid repeating the same rhyme character merely to prove a rhyme.

Mandarin has four lexical tones plus a neutral tone, but modern Mandarin singing does not require melody to trace every lexical contour. Treat tone–melody alignment as a soft intelligibility check, especially on exposed phrase endings, repeated hooks, unusual names, and ambiguous short words. Do not distort the melody mechanically to follow tones. Instead, sing-test crucial lines, keep semantic context clear, avoid splitting compounds, and replace a word if a long or accented note makes it repeatedly misheard. Neutral particles such as 的、了、吗、呢、吧 should rarely carry the main emotional peak unless deliberately stylized.

Prefer present-day speech, specific behavior, and recognizable places over generic translated sentiment. Keep 你 and 您 socially coherent. Use English code-switching only when it belongs to the narrator, audience, and genre. Do not imitate a living artist, borrow a famous 成句, or confuse Mandarin with Cantonese conventions. End by reading the lyric aloud, clapping the character rhythm, checking rhyme finals, and listening to a generated vocal for diction before approving it.`,
}
