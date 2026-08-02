import type { SongSection, SongwritingLanguagePack } from '../types'

const devanagari = /[\u0900-\u097f]/
const devanagariConsonant = /[\u0915-\u0939\u0958-\u095f\u0978-\u097f]/
const independentVowel = /[\u0904-\u0914\u0960-\u0961]/
const vowelSign = /[\u093a-\u094c\u094e-\u094f\u0955-\u0957\u0962-\u0963]/
const virama = '\u094d'

function cleanDevanagari(raw: string) {
  return [...raw.normalize('NFC')].filter((character) => /[\u0900-\u097f]/.test(character) && character !== '\u093c')
}

/** Approximate pronounced aksharas, including the common word-final schwa deletion. */
export function hindiSyllables(raw: string) {
  if (!raw.trim()) return 0
  if (devanagari.test(raw)) {
    const characters = cleanDevanagari(raw)
    let nuclei = 0
    for (let index = 0; index < characters.length; index += 1) {
      const character = characters[index]
      if (independentVowel.test(character)) nuclei += 1
      else if (devanagariConsonant.test(character)) {
        const next = characters[index + 1] ?? ''
        if (next === virama) continue
        const hasWrittenVowel = vowelSign.test(next)
        const isFinalImplicitSchwa = !hasWrittenVowel && index === characters.length - 1
        const nextConsonantTakesWrittenVowel = !hasWrittenVowel && devanagariConsonant.test(next) && vowelSign.test(characters[index + 2] ?? '')
        if (!isFinalImplicitSchwa && !nextConsonantTakesWrittenVowel) nuclei += 1
        else if (hasWrittenVowel) nuclei += 1
      }
    }
    return Math.max(1, nuclei)
  }
  const word = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')
  if (!word) return 0
  const nuclei = word.match(/aa|ai|au|ee|ii|oo|uu|[aeiou]/g)
  return Math.max(1, nuclei?.length ?? 1)
}

export function hindiRhymeKey(raw: string) {
  if (devanagari.test(raw)) {
    const characters = cleanDevanagari(raw).filter((character) => character !== virama)
    let lastVowel = -1
    for (let index = 0; index < characters.length; index += 1) {
      if (independentVowel.test(characters[index]) || vowelSign.test(characters[index])) lastVowel = index
    }
    if (lastVowel < 0) return characters.slice(-1).join('')
    const sound = new Map([
      ['अ', 'a'], ['आ', 'a'], ['ा', 'a'], ['इ', 'i'], ['ि', 'i'], ['ई', 'ii'], ['ी', 'ii'],
      ['उ', 'u'], ['ु', 'u'], ['ऊ', 'uu'], ['ू', 'uu'], ['ऋ', 'ri'], ['ृ', 'ri'], ['ए', 'e'], ['े', 'e'],
      ['ऐ', 'ai'], ['ै', 'ai'], ['ओ', 'o'], ['ो', 'o'], ['औ', 'au'], ['ौ', 'au'],
    ])
    return `${sound.get(characters[lastVowel]) ?? characters[lastVowel]}${characters.slice(lastVowel + 1).join('')}`
  }
  const word = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')
    .replace(/aa/g, 'a').replace(/ee|ii/g, 'i').replace(/oo|uu/g, 'u')
  if (!word) return ''
  const matches = [...word.matchAll(/ai|au|[aeiou]/g)]
  return matches.length ? word.slice(matches.at(-1)?.index ?? Math.max(0, word.length - 2)) : word.slice(-2)
}

function hindiReview(draft: { title: string; hook: string; lyrics: string }, sections: SongSection[]) {
  const strengths: string[] = []
  const suggestions: string[] = []
  const words = draft.lyrics.toLowerCase().match(/[\p{L}\p{M}\p{N}']+/gu) ?? []
  const devanagariWords = words.filter((word) => devanagari.test(word))
  const latinWords = words.filter((word) => /[a-z]/i.test(word))
  const pronounFamilies = [
    { label: 'तू / tu', test: (word: string) => ['तू', 'तुझे', 'तुझको', 'तुझसे', 'तुझमें', 'तेरा', 'तेरी', 'तेरे', 'tu', 'tujhe', 'tujhko', 'tujhse', 'tujhmein', 'tera', 'teri', 'tere'].includes(word) },
    { label: 'तुम / tum', test: (word: string) => word === 'तुम' || word.startsWith('तुम्ह') || word === 'tum' || word.startsWith('tumh') },
    { label: 'आप / aap', test: (word: string) => word === 'आप' || word.startsWith('आपक') || word === 'आपसे' || word === 'आपको' || word === 'आपमें' || word === 'aap' || word.startsWith('aapk') || ['aapse', 'aapko', 'aapmein'].includes(word) },
  ].filter((family) => words.some(family.test))
  const conversational = words.filter((word) => ['ना', 'तो', 'भी', 'बस', 'फिर', 'क्यों', 'कैसे', 'यहीं', 'वहीं', 'चल', 'चलो', 'रुक', 'रुको', 'देख', 'देखो', 'सुन', 'सुनो', 'बता', 'बताओ', 'कह', 'कहो', 'क्या', 'कहाँ', 'sun', 'suno', 'dekho', 'batao', 'bas', 'phir', 'kyun', 'kaise', 'kya', 'kahan'].includes(word)).length
  const literaryAbstractions = words.filter((word) => ['एहसास', 'खामोशी', 'तन्हाई', 'रूह', 'मुकम्मल', 'फ़ासला', 'फासला', 'इश्क़', 'इश्क', 'तक़दीर', 'तक़दीर', 'जज़्बात', 'नयन', 'स्वप्न', 'अनंत', 'विरह', 'आलोक', 'हृदय', 'प्रणय', 'शाश्वत', 'jazbaat', 'ehsaas', 'khamoshi', 'tanhai', 'rooh', 'mukammal', 'faasla', 'ishq', 'taqdeer', 'nayan', 'swapn', 'anant', 'virah', 'aalok', 'hriday', 'pranay', 'shashwat'].includes(word)).length
  const hasMukhda = sections.some((section) => section.label.includes('मुखड़ा') || section.label.toLowerCase().includes('mukhda'))
  const hasAntara = sections.some((section) => section.label.includes('अंतरा') || section.label.toLowerCase().includes('antara'))
  const coupletHeavySections = sections.filter((section) => {
    if (section.kind !== 'verse' || section.lines.length < 6) return false
    let matchingPairs = 0
    const pairCount = Math.floor(section.lines.length / 2)
    for (let index = 0; index + 1 < section.lines.length; index += 2) {
      const first = section.lines[index].match(/[\p{L}\p{M}\p{N}']+/gu)?.at(-1) ?? ''
      const second = section.lines[index + 1].match(/[\p{L}\p{M}\p{N}']+/gu)?.at(-1) ?? ''
      if (hindiRhymeKey(first) && hindiRhymeKey(first) === hindiRhymeKey(second)) matchingPairs += 1
    }
    return matchingPairs / Math.max(1, pairCount) >= 0.6
  })

  if (hasMukhda && hasAntara) strengths.push('The lyric uses a native mukhda–antara song form: a recurring central thought with room for narrative development.')
  if (conversational >= 3) strengths.push('Conversational particles and direct verbs help the Hindi sound spoken and singable rather than formally recited.')
  if (pronounFamilies.length > 1) suggestions.push(`Choose one relationship register—${pronounFamilies.map((family) => family.label).join(', ')} currently mix—unless the change is a deliberate story event.`)
  if (devanagariWords.length && latinWords.length / Math.max(1, words.length) > 0.12) suggestions.push('Make the Hinglish switches intentional: keep Hindi as the grammatical base and use English only where this narrator would naturally say it.')
  if (literaryAbstractions >= 4) suggestions.push('This is drifting toward written poetry. Replace several abstract Urdu/Hindi nouns with something the singer does, notices, asks, or cannot bring themself to say.')
  if (coupletHeavySections.length) suggestions.push('The antaras resolve too consistently as rhyming couplets, which can sound recited. Loosen one rhyme pair, add a plain spoken line, and use the final line to turn naturally back into the mukhda.')
  if (!hasMukhda) suggestions.push('For a contemporary Hindi song, consider a short mukhda that states the central thought and can return unchanged after each antara.')
  if (devanagariWords.length) strengths.push('Devanagari gives the singer and generator clearer Hindi pronunciation than ad-hoc Romanization.')
  return { strengths, suggestions }
}

export const hindiSongwriting: SongwritingLanguagePack = {
  id: 'hi',
  name: 'Hindi / Hindustani',
  locale: 'hi-IN',
  aliases: ['Hindi', 'Hindustani', 'Hinglish', 'हिंदी', 'हिन्दी', 'hi-IN'],
  description: 'Contemporary Hindi and Hindustani songwriting with Devanagari or deliberate Hinglish, mukhda–antara form, sung prosody, sound-based rhyme, register, and agreement coaching.',
  templates: [
    { id: 'mukhda-antara', name: 'मुखड़ा–अंतरा', description: 'A concise recurring mukhda, two escalating antaras, and natural return lines.', sections: ['मुखड़ा', 'अंतरा 1', 'मुखड़ा', 'अंतरा 2', 'मुखड़ा', 'समापन'] },
    { id: 'indie-folk', name: 'इंडी फ़ोक', description: 'Conversational scene-setting that grows from a private hook into an ensemble payoff.', sections: ['भूमिका', 'अंतरा 1', 'पूर्व-मुखड़ा', 'मुखड़ा', 'अंतरा 2', 'मुखड़ा', 'सेतु', 'अंतिम मुखड़ा', 'समापन'] },
    { id: 'filmi-romance', name: 'फ़िल्मी रोमांस', description: 'A strong title thought, rising antaras, musical interludes, and a final emotional turn.', sections: ['प्रस्तावना', 'मुखड़ा', 'अंतरा 1', 'मुखड़ा', 'अंतरा 2', 'मुखड़ा', 'सेतु', 'अंतिम मुखड़ा'] },
    { id: 'hindustani-fusion', name: 'हिंदुस्तानी फ़्यूज़न', description: 'Lead-and-ensemble form suited to folk, qawwali-adjacent, or live-session arrangements without forcing ghazal rules.', sections: ['आलाप', 'मुखड़ा', 'अंतरा 1', 'सामूहिक मुखड़ा', 'अंतरा 2', 'बोल-बाँट', 'अंतिम मुखड़ा', 'समापन'] },
  ],
  quickSections: ['अंतरा', 'पूर्व-मुखड़ा', 'मुखड़ा', 'सेतु', 'समापन'],
  lyricPlaceholder: '[अंतरा 1]\nकिसी खास पल, जगह या काम से कहानी शुरू करें…\n\n[मुखड़ा]\nछोटी, बोलचाल की केंद्रीय पंक्ति लौटाएँ…',
  sectionAliases: {
    intro: ['भूमिका', 'प्रस्तावना', 'आलाप', 'shuruat', 'alaap'],
    verse: ['अंतरा', 'antara'],
    'pre-chorus': ['पूर्व-मुखड़ा', 'पूर्व मुखड़ा', 'pre-mukhda'],
    chorus: ['मुखड़ा', 'मुखड़ा', 'स्थायी', 'mukhda', 'sthayi'],
    bridge: ['सेतु', 'मध्यांतर', 'बोल-बाँट', 'bol-baant'],
    breakdown: ['वाद्य विराम', 'ताल विराम'],
    outro: ['समापन', 'अंतिम आलाप', 'विदाई'],
  },
  cliches: [
    'दिल टूट गया', 'तेरे बिना अधूरा', 'आँखों में नमी', 'साँसों में बसा', 'चाँद सितारे', 'इश्क़ का समंदर', 'सात जन्म', 'हर जन्म',
    'dil toot gaya', 'tere bina adhoora', 'aankhon mein nami', 'saanson mein basa', 'chaand sitaare', 'ishq ka samandar',
  ],
  sensoryWords: [
    'बारिश', 'मिट्टी', 'खुशबू', 'चाय', 'खिड़की', 'दरवाज़ा', 'गली', 'छत', 'धूप', 'ठंड', 'गर्म', 'धुआँ', 'आवाज़', 'खामोशी', 'नमक', 'मीठा', 'कड़वा', 'गीला', 'जूते', 'चादर', 'बस', 'ट्रेन', 'सड़क', 'कमरा',
    'baarish', 'mitti', 'khushboo', 'chai', 'khidki', 'darwaza', 'gali', 'chhat', 'dhoop', 'thand', 'garam', 'dhuaan', 'awaaz', 'namak', 'meetha', 'geela', 'sadak', 'kamra',
  ],
  syllables: hindiSyllables,
  rhymeKey: hindiRhymeKey,
  review: hindiReview,
  coachingGuide: `Write a song in natural contemporary Hindi/Hindustani, not a page of ornate poetry. Choose the relationship register first—तू, तुम, or आप—and keep pronouns, possessives, verb gender, and respect level coherent. Draft in Devanagari for model pronunciation; provide a consistently spelled Romanized performance copy only when requested. Use Hinglish only where the narrator would genuinely code-switch, not to rescue a rhyme.

Build the song around a short mukhda: the “face” of the song should state its central thought in one or two memorable lines and survive exact repetition. Let each antara add a new scene, action, question, or consequence. End an antara with a cross-line that makes the return to the mukhda feel inevitable. A bridge or सेतु must change the decision, relationship, scale, or point of view.

Count sung vowel nuclei approximately, not written characters; Hindi commonly deletes implicit schwas. Keep neighboring lines compatible in breath and weight, while leaving room for melodic stretching on open vowels. Rhyme by sound. Qaafiya and radeef can strengthen a refrain, but do not force formal ghazal rules onto an indie, folk, film, or pop song. Avoid reversed syntax written only for rhyme, strings of abstract nouns, constant moon/rain/heart imagery, and a metaphor in every line. Pair one fresh image with plain speech, physical behavior, and something the singer wants now. Read every line aloud as dialogue: if a person would never say it and the melody does not justify it, rewrite it.`,
}
