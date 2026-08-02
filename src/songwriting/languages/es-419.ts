import type { SongSection, SongwritingLanguagePack } from '../types'

const segmenter = new Intl.Segmenter('es-419', { granularity: 'word' })
const spanishWord = /[a-záéíóúüñ]+/gi
const vowels = 'aeiouáéíóúüy'
const strongVowels = 'aeoáéóíú'

export function latinSpanishTokens(text: string) {
  return [...segmenter.segment(text.normalize('NFC'))]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment.toLocaleLowerCase('es-419'))
}

function preparedWord(raw: string) {
  const word = raw.normalize('NFC').toLocaleLowerCase('es-419').replace(/[^a-záéíóúüñ]/g, '')
  return word.replace(/qu(?=[eéií])/g, 'q').replace(/gu(?=[eéií])/g, 'g').replace(/y$/g, 'i')
}

function isVowel(character: string) {
  return vowels.includes(character)
}

function separatesVowels(left: string, right: string) {
  if ('íú'.includes(left) || 'íú'.includes(right)) return true
  return strongVowels.includes(left) && strongVowels.includes(right)
}

function vowelNuclei(raw: string) {
  const word = preparedWord(raw)
  const nuclei: Array<{ start: number; end: number }> = []
  let active: { start: number; end: number } | null = null
  let previousVowel = ''
  for (let index = 0; index < word.length; index += 1) {
    const character = word[index]
    if (character === 'h' && active && isVowel(word[index + 1] ?? '')) continue
    if (!isVowel(character)) {
      active = null
      previousVowel = ''
      continue
    }
    if (!active || separatesVowels(previousVowel, character)) {
      active = { start: index, end: index }
      nuclei.push(active)
    } else active.end = index
    previousVowel = character
  }
  return { word, nuclei }
}

/** Orthographic Spanish syllable estimate with diphthong, triphthong, hiatus, and silent-u handling. */
export function latinSpanishSyllables(raw: string) {
  const words = raw.match(spanishWord) ?? []
  const syllables = words.reduce((sum, word) => sum + Math.max(1, vowelNuclei(word).nuclei.length), 0)
  return syllables + (raw.match(/\d+/g)?.length ?? 0)
}

function phoneticSpanish(raw: string) {
  return raw
    .normalize('NFC')
    .toLocaleLowerCase('es-419')
    .replace(/qu(?=[eéií])/g, 'k')
    .replace(/gü(?=[eéií])/g, 'w')
    .replace(/gu(?=[eéií])/g, 'g')
    .replace(/c(?=[eéií])/g, 's')
    .replace(/g(?=[eéií])/g, 'x')
    .replace(/ll/g, 'y')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/j/g, 'x')
    .replace(/h/g, '')
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .replace(/[^a-zñ]/g, '')
}

/** Returns the Latin American rhyme tail beginning at the stressed vowel. */
export function latinSpanishRhymeKey(raw: string) {
  const token = raw.match(spanishWord)?.at(-1) ?? ''
  if (!token) return ''
  const { word, nuclei } = vowelNuclei(token)
  if (!nuclei.length) return phoneticSpanish(word).slice(-2)
  const accentedIndex = [...word].findIndex((character) => 'áéíóú'.includes(character))
  let stressedNucleus = accentedIndex >= 0
    ? nuclei.findIndex((nucleus) => accentedIndex >= nucleus.start && accentedIndex <= nucleus.end)
    : -1
  if (stressedNucleus < 0) stressedNucleus = /[aeiouáéíóúü]$|[ns]$/.test(word) ? Math.max(0, nuclei.length - 2) : nuclei.length - 1
  const nucleus = nuclei[stressedNucleus]
  const nucleusText = [...word.slice(nucleus.start, nucleus.end + 1)]
  const explicitAccent = nucleusText.findIndex((character) => 'áéíóú'.includes(character))
  const strong = nucleusText.findIndex((character) => strongVowels.includes(character))
  const start = nucleus.start + (explicitAccent >= 0 ? explicitAccent : Math.max(0, strong))
  return phoneticSpanish(word.slice(start))
}

function countTerms(text: string, terms: string[]) {
  const normalized = text.toLocaleLowerCase('es-419')
  return terms.filter((term) => normalized.includes(term)).length
}

function latinSpanishReview(draft: { title: string; hook: string; lyrics: string }, sections: SongSection[]) {
  const strengths: string[] = []
  const suggestions: string[] = []
  const tokens = latinSpanishTokens(draft.lyrics)
  const spanishCharacters = draft.lyrics.match(/[a-záéíóúüñ]/gi)?.length ?? 0
  const accentedCharacters = draft.lyrics.match(/[áéíóúüñ¿¡]/gi)?.length ?? 0
  const hookLength = latinSpanishTokens(draft.hook).length
  const hasNativeVerse = sections.some((section) => /verso|estrofa/.test(section.label.toLocaleLowerCase('es-419')))
  const hasNativeChorus = sections.some((section) => /coro|estribillo|gancho/.test(section.label.toLocaleLowerCase('es-419')))
  const tokenSet = new Set(tokens)
  const usesTu = tokenSet.has('tú') || tokenSet.has('tu')
  const usesVos = tokenSet.has('vos')
  const usesUsted = tokenSet.has('usted')
  const usesVosotros = tokenSet.has('vosotros') || tokenSet.has('vosotras') || tokenSet.has('os')
  const regionalSignals = [
    ['Mexico', ['güey', 'wey', 'chido', 'órale', 'neta']],
    ['Caribbean', ['janguear', 'perreo', 'bellaqueo', 'corillo', 'guagua']],
    ['Southern Cone', ['che', 'laburo', 'pibe', 're copado', 'boludo']],
    ['Colombia', ['parce', 'bacano', 'parcero', 'chévere']],
  ].filter(([, terms]) => countTerms(draft.lyrics, terms as string[]) >= 1).map(([region]) => region)
  const conversational = countTerms(draft.lyrics, ['mira', 'oye', 'dime', 'quédate', 'ya sé', 'la verdad', 'no pasa nada', 'espérame', 'ven', 'vámonos', 'te juro'])
  const clichés = countTerms(draft.lyrics, ['sin ti no soy nada', 'hasta el fin del mundo', 'eres mi vida', 'mi media naranja', 'fuego en la piel', 'dueño de mi corazón', 'bajo la luna', 'esta noche es de los dos'])
  const lineLengths = sections.flatMap((section) => section.lines.map(latinSpanishSyllables)).filter(Boolean)
  const crowdedLines = lineLengths.filter((length) => length > 16).length

  if (hasNativeVerse && hasNativeChorus) strengths.push('The lyric uses clear Spanish section labels, so its narrative and hook returns are easy to preserve.')
  if (hookLength >= 2 && hookLength <= 8) strengths.push('The Spanish hook is compact enough to remember and repeat without rushing its vowels.')
  if (conversational >= 3) strengths.push('The lyric uses contemporary spoken Spanish rather than translated literary prose.')
  if ((usesTu ? 1 : 0) + (usesVos ? 1 : 0) + (usesUsted ? 1 : 0) > 1) suggestions.push('The lyric mixes tú, vos, and/or usted. Choose the relationship and regional voice, or make the change a deliberate shift in intimacy or respect.')
  if (usesVosotros) suggestions.push('This pack defaults to Latin American Spanish, where ustedes normally replaces vosotros. Keep vosotros only if the narrator or target region is specifically from Spain.')
  if (regionalSignals.length > 1) suggestions.push(`The slang points to several regions (${regionalSignals.join(', ')}). Choose one home base or make the mixed geography explicit in the story.`)
  if (spanishCharacters > 100 && accentedCharacters === 0) suggestions.push('Check written accents and opening ¿/¡ marks. Missing diacritics can change stress, meaning, and the rhyme analysis.')
  if (hookLength > 11) suggestions.push('Shorten the Spanish hook to a phrase listeners can answer in one breath; move its explanation into the verso or pre-coro.')
  if (clichés >= 3) suggestions.push('Trade generic romance phrases for a local action, object, time, or place that only this narrator would notice.')
  if (crowdedLines >= Math.max(2, Math.ceil(lineLengths.length / 3))) suggestions.push('Several lines exceed sixteen approximate syllables. Shorten them or design the melody for deliberate rapid delivery and natural sinalefa.')
  if (!hasNativeChorus) suggestions.push('Tag a clear coro or estribillo and center it on the title payoff; each verso should change the scene, information, or emotional stakes.')
  return { strengths, suggestions }
}

export const latinSpanishSongwriting: SongwritingLanguagePack = {
  id: 'es-419',
  name: 'Spanish (Latin American)',
  locale: 'es-419',
  aliases: ['es', 'Spanish', 'Latin Spanish', 'Latin American Spanish', 'Latino', 'Latina', 'Español', 'Español latino', 'Español latinoamericano', 'Castellano latinoamericano'],
  description: 'Latin American Spanish songwriting with regional-register control, diphthong-aware meter, stress-based rhyme, native labels, and distinct pop, urbano, bachata, salsa, ballad, and regional forms.',
  templates: [
    { id: 'latin-pop', name: 'Pop latino', description: 'A concise contemporary pop arc with an early title payoff, escalating pre-choruses, and a bridge decision.', sections: ['Intro', 'Verso 1', 'Pre-coro', 'Coro', 'Verso 2', 'Pre-coro', 'Coro', 'Puente', 'Coro final', 'Outro'] },
    { id: 'reggaeton-urbano', name: 'Reguetón / urbano', description: 'A hook-forward vocal form whose repeated dembow gains motion through delivery, density, dropouts, and section contrast.', sections: ['Intro / llamada', 'Coro', 'Verso 1', 'Pre-coro', 'Coro', 'Verso 2 / rap', 'Bajada', 'Coro final', 'Outro DJ'] },
    { id: 'bachata-modern', name: 'Bachata moderna', description: 'Intimate narrative verses, a highly singable romantic chorus, and an instrumental guitar release.', sections: ['Intro de guitarra', 'Verso 1', 'Pre-coro', 'Coro', 'Verso 2', 'Coro', 'Mambo / guitarra', 'Puente', 'Coro final', 'Cierre'] },
    { id: 'salsa-tropical', name: 'Salsa / tropical', description: 'A composed opening that opens into call-and-response coro–pregón energy and a final mambo lift.', sections: ['Introducción', 'Verso 1', 'Verso 2', 'Coro', 'Pregón 1', 'Coro', 'Pregón 2', 'Mambo', 'Coro final', 'Cierre'] },
    { id: 'balada-latina', name: 'Balada latina', description: 'Scene-led verses and a broad melodic chorus whose final return changes meaning after the confession.', sections: ['Introducción', 'Verso 1', 'Verso 2', 'Coro', 'Interludio', 'Verso 3', 'Coro', 'Puente', 'Coro final', 'Coda'] },
    { id: 'regional-narrative', name: 'Regional mexicano narrativo', description: 'A compact story with named stakes, advancing verses, a memorable refrain, and room for an instrumental signature.', sections: ['Introducción', 'Verso 1', 'Verso 2', 'Estribillo', 'Interludio', 'Verso 3', 'Estribillo', 'Despedida'] },
  ],
  quickSections: ['Verso', 'Pre-coro', 'Coro', 'Pregón', 'Puente', 'Interludio', 'Coro final'],
  lyricPlaceholder: '[Verso 1]\nEmpieza con una hora, un lugar o una acción concreta…\n\n[Pre-coro]\nSube la presión sin explicar de más…\n\n[Coro]\nCanta el título y la promesa central en español natural y memorable…',
  sectionAliases: {
    intro: ['intro', 'introducción', 'entrada', 'llamada', 'intro / llamada', 'intro de guitarra'],
    verse: ['verso', 'estrofa', 'copla', 'pregón', 'verso 2 / rap'],
    'pre-chorus': ['pre-coro', 'precoro', 'pre coro', 'subida'],
    chorus: ['coro', 'estribillo', 'gancho', 'coro final'],
    'post-chorus': ['post-coro', 'poscoro', 'respuesta'],
    bridge: ['puente', 'quiebre', 'confesión'],
    breakdown: ['bajada', 'interludio', 'mambo', 'mambo / guitarra', 'solo', 'descarga'],
    outro: ['outro', 'cierre', 'coda', 'despedida', 'outro dj'],
  },
  cliches: ['sin ti no soy nada', 'hasta el fin del mundo', 'eres mi vida', 'mi media naranja', 'fuego en la piel', 'dueño de mi corazón', 'bajo la luna', 'esta noche es de los dos', 'bailando hasta el amanecer', 'corazón roto', 'amor verdadero', 'perderme en tu mirada', 'detener el tiempo', 'como la primera vez'],
  sensoryWords: ['madrugada', 'andén', 'banqueta', 'acera', 'azotea', 'balcón', 'malecón', 'esquina', 'semáforo', 'ventilador', 'persiana', 'nota de voz', 'vaso', 'hielo', 'café', 'sal', 'perfume', 'gasolina', 'lluvia', 'sudor', 'arena', 'asfalto', 'neón', 'tambor', 'cuerda', 'llaves', 'camisa', 'tacones', 'frío', 'pegajoso', 'ronco', 'brillante'],
  tokenize: latinSpanishTokens,
  syllables: latinSpanishSyllables,
  rhymeKey: latinSpanishRhymeKey,
  review: latinSpanishReview,
  coachingGuide: `Write natural contemporary Latin American Spanish. The default is broadly understandable pan-Latin Spanish, not a fictional accentless dialect. If the user names Mexico, Puerto Rico, the Dominican Republic, Cuba, Colombia, Venezuela, Central America, the Andes, Chile, Argentina, Uruguay, or another community, choose that voice deliberately and research its vocabulary and social register. Keep tú, vos, usted, and their verb forms coherent. Use ustedes rather than vosotros by default. Do not mix slang from several countries simply to sound “Latino,” and do not flatten Afro-Caribbean, Indigenous, border, or regional Mexican traditions into one generic style.

Start from a singable title phrase and one clear promise. In pop latino, let versos advance a specific relationship and make the pre-coro raise pressure before the coro answers plainly. In reguetón and urbano, the dembow is a rhythmic foundation, not a substitute for writing: use short phonetic cells, conversational commands or questions, cadence shifts, strategic silence, and a hook that can survive repetition. Change arrangement density and vocal flow between returns. In bachata, pair close emotional storytelling with guitar-shaped breathing room. In salsa or tropical writing, distinguish the composed cuerpo from the later coro–pregón exchange: the coro must leave a clear pocket for improvised or rotating responses, and the pregones should intensify, comment, and involve the room. In a balada, earn the final high note through narrative change. In regional Mexican storytelling, establish who, where, what is at risk, and what changed; never reduce a living regional tradition to costumes or cartel clichés.

Spanish meter follows vowel nuclei, not spelling length. Treat diphthongs and triphthongs as one nucleus, accented weak vowels as hiatus, and remember that actual sung division varies by region, tempo, and performance. Sinalefa can join a final vowel to the next word's initial vowel, while expressive singing can separate a normal diphthong. The analyzer gives an orthographic estimate; sing the line to decide. Place open vowels on long or high notes when possible, and preserve natural word stress unless a genre-specific delivery intentionally displaces it.

Rhyme from the stressed vowel to the word ending. Decide whether a passage needs consonant rhyme, looser assonance, internal rhyme, or no obvious rhyme. Latin American seseo makes c/z before e or i rhyme as /s/ in this pack. Do not bend syntax, omit required accents, or repeat the same diminutive and verb ending merely to close every line. In urbano, multisyllabic rhyme and repeated rhythmic shapes often matter more than neat couplets; in coro–pregón, response and momentum matter more than literary closure.

Prefer speech, action, and regional reality over ornamental poetry. Opening ¿ and ¡, written accents, and ñ matter because they preserve meaning and stress. English or Spanglish can be authentic for a specific narrator or scene, but it must belong to the character rather than operate as a generic commercial garnish. Avoid sexual clichés that erase agency; make desire reciprocal and specific. Do not imitate a living artist or reuse a recognizable title, melodic cadence, catchphrase, or lyric. Finish by reading the lyric aloud in the chosen regional voice, clapping its stresses against the groove, checking every pronoun/register choice, and listening to a generated vocal before approval.`,
}
