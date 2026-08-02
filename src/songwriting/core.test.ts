import { describe, expect, it } from 'vitest'
import { analyzeSongwriting, applyStructureTemplate, buildSongwritingPrompt, emptySongwritingDraft, parseSongSections, prepareLyricsForGenerator } from './core'
import { hindiRhymeKey, hindiSyllables } from './languages/hi'
import { japaneseMoras, japaneseRhymeKey, japaneseTokens } from './languages/ja-JP'
import { koreanRhymeKey, koreanSyllables, koreanTokens } from './languages/ko-KR'
import { latinSpanishRhymeKey, latinSpanishSyllables, latinSpanishTokens } from './languages/es-419'
import { mandarinRhymeKey, mandarinSyllables, mandarinTokens } from './languages/zh-CN'
import { getSongwritingLanguage, listSongwritingLanguages } from './registry'

describe('extensible songwriting engine', () => {
  it('registers English as a language pack rather than a hard-coded mode', () => {
    expect(listSongwritingLanguages().map((pack) => pack.id)).toContain('en')
  })

  it('registers Hindi as a discoverable language pack', () => {
    const hindi = listSongwritingLanguages().find((pack) => pack.id === 'hi')
    expect(hindi?.name).toBe('Hindi / Hindustani')
    expect(hindi?.templates.map((template) => template.id)).toContain('mukhda-antara')
  })

  it('registers Mandarin with names a context-free agent can discover', () => {
    const mandarin = listSongwritingLanguages().find((pack) => pack.id === 'zh-CN')
    expect(mandarin?.name).toBe('Mandarin Chinese (Simplified)')
    expect(mandarin?.aliases).toEqual(expect.arrayContaining(['Chinese', 'Mandarin', '中文', '普通话']))
    expect(mandarin?.templates.map((template) => template.id)).toEqual(expect.arrayContaining(['mandopop-modern', 'mandarin-hip-hop', 'guofeng-fusion']))
    expect(getSongwritingLanguage('Chinese').id).toBe('zh-CN')
    expect(getSongwritingLanguage('普通話').id).toBe('zh-CN')
    expect(emptySongwritingDraft('Mandarin').language).toBe('zh-CN')
  })

  it('registers Korean and resolves common K-pop names without prior context', () => {
    const korean = getSongwritingLanguage('K-pop')
    expect(korean.id).toBe('ko-KR')
    expect(korean.aliases).toEqual(expect.arrayContaining(['Korean', '한국어', '케이팝']))
    expect(korean.templates.map((template) => template.id)).toEqual(expect.arrayContaining(['kpop-performance', 'korean-hip-hop', 'korean-ballad']))
    expect(emptySongwritingDraft('한국말').language).toBe('ko-KR')
  })

  it('registers Latin American Spanish and resolves user-facing aliases', () => {
    const spanish = getSongwritingLanguage('Latino')
    expect(spanish.id).toBe('es-419')
    expect(spanish.aliases).toEqual(expect.arrayContaining(['Spanish', 'Español', 'Latin American Spanish']))
    expect(spanish.templates.map((template) => template.id)).toEqual(expect.arrayContaining(['latin-pop', 'reggaeton-urbano', 'salsa-tropical']))
    expect(emptySongwritingDraft('Español latino').language).toBe('es-419')
  })

  it('registers Japanese and resolves J-pop names in Japanese or English', () => {
    const japanese = getSongwritingLanguage('J-pop')
    expect(japanese.id).toBe('ja-JP')
    expect(japanese.aliases).toEqual(expect.arrayContaining(['Japanese', '日本語', 'ジェイポップ']))
    expect(japanese.templates.map((template) => template.id)).toEqual(expect.arrayContaining(['jpop-standard', 'anime-opening', 'city-pop']))
    expect(emptySongwritingDraft('にほんご').language).toBe('ja-JP')
  })

  it('parses tagged sections and analyzes English prosody', () => {
    const lyrics = `[Verse 1]\nCoffee cooling by the kitchen door\nYour red coat is missing from the chair\n\n[Chorus]\nLeave the porch light on\nLeave the porch light on\nI will find the road back home\n\n[Bridge]\nMaybe home is who still waits`
    const analysis = analyzeSongwriting({ language: 'en', title: 'Porch Light', hook: 'Leave the porch light on', lyrics })
    expect(parseSongSections(lyrics).map((section) => section.kind)).toEqual(['verse', 'chorus', 'bridge'])
    expect(analysis.counts.lines).toBe(6)
    expect(analysis.scores.hook).toBeGreaterThan(50)
    expect(analysis.detectedHook).toBe('Leave the porch light on')
    expect(analysis.scores.imagery).toBeGreaterThanOrEqual(30)
  })

  it('applies structures without discarding matching section text', () => {
    const draft = { ...emptySongwritingDraft(), lyrics: '[Chorus]\nStay until the streetlights fade' }
    const structured = applyStructureTemplate(draft, 'modern-pop')
    expect(structured.lyrics).toContain('[Verse 1]')
    expect(structured.lyrics).toContain('Stay until the streetlights fade')
  })

  it('does not treat an intentionally repeated chorus like duplicated verse filler', () => {
    const chorusRepeat = analyzeSongwriting({ language: 'en', title: 'Porch Light', hook: 'Leave the porch light on', lyrics: '[Verse]\nCoffee cooling by the door\n\n[Chorus]\nLeave the porch light on\n\n[Chorus]\nLeave the porch light on' })
    const verseRepeat = analyzeSongwriting({ language: 'en', title: 'Porch Light', hook: 'Leave the porch light on', lyrics: '[Verse]\nCoffee cooling by the door\nCoffee cooling by the door\n\n[Chorus]\nLeave the porch light on' })
    expect(chorusRepeat.counts.hookRepetitions).toBe(1)
    expect(chorusRepeat.counts.unintentionalRepeatedLines).toBe(0)
    expect(chorusRepeat.scores.originality).toBeGreaterThan(verseRepeat.scores.originality)
  })

  it('recognizes recurring pre-chorus and transition refrains as structural repetition', () => {
    const analysis = analyzeSongwriting({ language: 'en', title: 'Turn It Up', hook: 'Light the hallway up', lyrics: '[Intro]\nTurn it up\n\n[Pre-Chorus]\nThe quiet starts to break\n\n[Chorus]\nLight the hallway up\n\n[Pre-Chorus]\nThe quiet starts to break\n\n[Breakdown]\nTurn it up\n\n[Outro]\nTurn it up' })
    expect(analysis.counts.repeatedLines).toBe(3)
    expect(analysis.counts.hookRepetitions).toBe(0)
    expect(analysis.counts.intentionalRepeatedLines).toBe(3)
    expect(analysis.counts.unintentionalRepeatedLines).toBe(0)
  })

  it('parses native Hindi section labels and detects a repeated mukhda', () => {
    const lyrics = `[अंतरा 1]\nखिड़की पर चाय ठंडी होती रही\nतुमने कहा था बस पाँच मिनट\n\n[मुखड़ा]\nतू बारिश बन के आ\nतू बारिश बन के आ\nमैं मिट्टी सा जाग जाऊँ\n\n[सेतु]\nआज मैं दरवाज़ा खुला रखूँगा`
    const analysis = analyzeSongwriting({ language: 'hi', title: 'बारिश बन के आ', hook: 'तू बारिश बन के आ', lyrics })
    expect(parseSongSections(lyrics, 'hi').map((section) => section.kind)).toEqual(['verse', 'chorus', 'bridge'])
    expect(analysis.detectedHook).toBe('तू बारिश बन के आ')
    expect(analysis.scores.hook).toBeGreaterThan(50)
    expect(analysis.scores.imagery).toBeGreaterThan(30)
  })

  it('estimates Hindi sung nuclei and sound-based rhyme in both scripts', () => {
    expect(hindiSyllables('बारिश')).toBe(2)
    expect(hindiSyllables('मिट्टी')).toBe(2)
    expect(hindiSyllables('baarish')).toBe(2)
    expect(hindiSyllables('खिड़की')).toBe(2)
    expect(hindiRhymeKey('नाम')).toBe(hindiRhymeKey('शाम'))
    expect(hindiRhymeKey('आ')).toBe(hindiRhymeKey('जा'))
    expect(hindiRhymeKey('naam')).toBe(hindiRhymeKey('shaam'))
  })

  it('flags mixed relationship registers and poetry-heavy Hindi', () => {
    const analysis = analyzeSongwriting({
      language: 'hi', title: 'फ़ासला', hook: 'तू लौट आ',
      lyrics: '[अंतरा]\nतू मेरी रूह का मुकम्मल एहसास\nआपकी खामोशी में तन्हाई का फ़ासला\n\n[मुखड़ा]\nतू लौट आ\nतू लौट आ',
    })
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('relationship register'))).toBe(true)
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('written poetry'))).toBe(true)
  })

  it('recognizes inflected and punctuated Hindi relationship registers', () => {
    const analysis = analyzeSongwriting({
      language: 'hi', title: 'रुक ना', hook: 'तू रुक ना',
      lyrics: '[अंतरा]\nतुझे चाय दूँ?\nआपसे एक बात कहूँ\n\n[मुखड़ा]\nतू, रुक ना\nतू, रुक ना',
    })
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('relationship register'))).toBe(true)
  })

  it('normalizes punctuation variants in native section labels', () => {
    const sections = parseSongSections('[पूर्व—मुखड़ा]\nबस दो मिनट रुक ना\n\n[मुखड़ा]\nतू बारिश बन के आ', 'hi')
    expect(sections.map((section) => section.kind)).toEqual(['pre-chorus', 'chorus'])
  })

  it('warns when every Hindi verse thought is boxed into a rhyming couplet', () => {
    const analysis = analyzeSongwriting({
      language: 'hi', title: 'भीगी शाम', hook: 'तू बारिश बन के आ',
      lyrics: '[अंतरा]\nखिड़की पर बारिश लिखे तेरा नाम\nचाय हुई ठंडी भीगी सी शाम\nगली के कोने पर पीली सी रात\nकाग़ज़ के पीछे छूटी हर बात\nकमरे में रखी पुरानी किताब\nतकिए के नीचे अधूरा जवाब\n\n[मुखड़ा]\nतू बारिश बन के आ\nतू बारिश बन के आ',
    })
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('rhyming couplets'))).toBe(true)
  })

  it('applies a Hindi mukhda-antara template without discarding the hook', () => {
    const draft = { ...emptySongwritingDraft('hi'), lyrics: '[मुखड़ा]\nतू बारिश बन के आ' }
    const structured = applyStructureTemplate(draft, 'mukhda-antara')
    expect(structured.lyrics).toContain('[अंतरा 1]')
    expect(structured.lyrics).toContain('तू बारिश बन के आ')
  })

  it('counts Mandarin Hanzi, tokenizes words, and rhymes by Pinyin final', () => {
    expect(mandarinSyllables('凌晨两点')).toBe(4)
    expect(mandarinSyllables('等你 at the station')).toBeGreaterThanOrEqual(6)
    expect(mandarinTokens('凌晨两点，末班地铁刚刚离站').length).toBeGreaterThan(5)
    expect(mandarinRhymeKey('窗')).toBe('uang')
    expect(mandarinRhymeKey('光')).toBe(mandarinRhymeKey('窗'))
    expect(mandarinRhymeKey('夢')).toBe(mandarinRhymeKey('风'))
  })

  it('parses Simplified and Traditional Mandarin section labels', () => {
    const lyrics = '[主歌 1]\n凌晨两点末班地铁离站\n我把没说的话留在车窗\n\n[副歌]\n等天亮 等天亮\n等天亮 等天亮\n\n[橋段]\n这一次我不再绕开真相\n\n[尾聲]\n站台只剩风'
    const analysis = analyzeSongwriting({ language: 'Chinese', title: '等天亮', hook: '等天亮', lyrics })
    expect(parseSongSections(lyrics, 'Mandarin').map((section) => section.kind)).toEqual(['verse', 'chorus', 'bridge', 'outro'])
    expect(analysis.language).toBe('zh-CN')
    expect(analysis.detectedHook).toBe('等天亮 等天亮')
    expect(analysis.counts.words).toBeGreaterThan(10)
    expect(analysis.scores.imagery).toBeGreaterThan(20)
  })

  it('provides Mandarin-specific register and poetry-drift coaching', () => {
    const analysis = analyzeSongwriting({
      language: 'zh-CN', title: '此生', hook: '你是宿命里的光',
      lyrics: '[主歌]\n你在红尘彼岸看尽浮生轮回\n您的执念穿过苍穹直到天涯\n\n[副歌]\n你是宿命里的光\n你是宿命里的光',
    })
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('你') && suggestion.includes('您'))).toBe(true)
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('国风'))).toBe(true)
  })

  it('builds a canonical Mandarin brief from a common-language alias', () => {
    const prompt = buildSongwritingPrompt({ ...emptySongwritingDraft('Chinese'), idea: 'Two strangers miss the last train and finally speak honestly' })
    expect(prompt).toContain('Mandarin Chinese (Simplified)')
    expect(prompt).toContain('Standard Mandarin')
    expect(prompt).toContain('副歌')
  })

  it('counts Hangul blocks and rhymes Korean by medial vowel and coda', () => {
    expect(koreanSyllables('새벽 두 시')).toBe(4)
    expect(koreanSyllables('네온 light 아래')).toBe(5)
    expect(koreanTokens('새벽 두 시, 마지막 지하철을 놓쳤어').length).toBeGreaterThan(5)
    expect(koreanRhymeKey('밤')).toBe(koreanRhymeKey('맘'))
    expect(koreanRhymeKey('빛')).toBe(koreanRhymeKey('짓'))
    expect(koreanRhymeKey('밤')).not.toBe(koreanRhymeKey('별'))
  })

  it('parses Korean production labels and coaches speech-level drift', () => {
    const lyrics = '[벌스 1]\n새벽 두 시 편의점 불빛 아래\n젖은 운동화로 네 전화를 기다려요\n\n[프리코러스]\n진동 한 번에 숨이 멎을 것 같아\n\n[후렴]\n그냥 여기 있어 줘\n그냥 여기 있어 줘\n\n[브리지]\n이제는 내가 먼저 갈게요'
    const analysis = analyzeSongwriting({ language: 'Korean', title: '여기 있어 줘', hook: '그냥 여기 있어 줘', lyrics })
    expect(parseSongSections(lyrics, 'K-pop').map((section) => section.kind)).toEqual(['verse', 'pre-chorus', 'chorus', 'bridge'])
    expect(analysis.language).toBe('ko-KR')
    expect(analysis.detectedHook).toBe('그냥 여기 있어 줘')
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('polite and casual'))).toBe(true)
    expect(analysis.scores.imagery).toBeGreaterThan(20)
  })

  it('builds a Korean brief that exposes K-pop-specific craft to an agent', () => {
    const prompt = buildSongwritingPrompt({ ...emptySongwritingDraft('케이팝'), idea: 'The last trainee leaves the practice room and finally calls home' })
    expect(prompt).toContain('Korean (K-pop)')
    expect(prompt).toContain('Korean–English code-switching')
    expect(prompt).toContain('포스트코러스')
  })

  it('counts Spanish vowel nuclei and rhymes from lexical stress', () => {
    expect(latinSpanishSyllables('canción')).toBe(2)
    expect(latinSpanishSyllables('ciudad')).toBe(2)
    expect(latinSpanishSyllables('todavía')).toBe(4)
    expect(latinSpanishSyllables('frío')).toBe(2)
    expect(latinSpanishTokens('¿Te quedas conmigo hasta que cierre el metro?').length).toBeGreaterThan(7)
    expect(latinSpanishRhymeKey('canción')).toBe(latinSpanishRhymeKey('corazón'))
    expect(latinSpanishRhymeKey('vida')).toBe(latinSpanishRhymeKey('herida'))
  })

  it('parses Spanish genre labels and catches incompatible regional voice', () => {
    const lyrics = '[Verso 1]\nMira, dejé las llaves junto al vaso\nVos dijiste que volvías al amanecer\n\n[Pre-coro]\nTú sabes lo que nunca pude decir\n\n[Coro]\nQuédate un minuto más\nQuédate un minuto más\n\n[Puente]\nUsted ya conoce la verdad'
    const analysis = analyzeSongwriting({ language: 'Latin Spanish', title: 'Un minuto más', hook: 'Quédate un minuto más', lyrics })
    expect(parseSongSections(lyrics, 'Español').map((section) => section.kind)).toEqual(['verse', 'pre-chorus', 'chorus', 'bridge'])
    expect(analysis.language).toBe('es-419')
    expect(analysis.detectedHook).toBe('Quédate un minuto más')
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('tú, vos'))).toBe(true)
    expect(analysis.scores.imagery).toBeGreaterThan(20)
  })

  it('builds a Spanish brief with regional and genre-specific guidance', () => {
    const prompt = buildSongwritingPrompt({ ...emptySongwritingDraft('Spanish'), genre: 'salsa', idea: 'Two old friends meet again on the malecón' })
    expect(prompt).toContain('Spanish (Latin American)')
    expect(prompt).toContain('tú, vos, usted')
    expect(prompt).toContain('coro–pregón')
  })

  it('counts Japanese morae and rhymes by final vowel pattern', () => {
    expect(japaneseMoras('きょう')).toBe(2)
    expect(japaneseMoras('がっこう')).toBe(4)
    expect(japaneseMoras('コーヒー')).toBe(4)
    expect(japaneseTokens('終電を逃して、コンビニで君を待った').length).toBeGreaterThan(5)
    expect(japaneseRhymeKey('せかい')).toBe(japaneseRhymeKey('ねがい'))
    expect(japaneseRhymeKey('しない')).toBe(japaneseRhymeKey('みたい'))
  })

  it('parses J-pop sections and catches narrator/register drift', () => {
    const lyrics = '[Aメロ 1]\n終電あとのホームで僕は待ってる\n濡れた袖に通知がひとつ光ります\n\n[Bメロ]\nねえ、ほんとはもう分かってるよ\n\n[サビ]\nあと一分だけここにいて\nあと一分だけここにいて\n\n[Cメロ]\n私から先にさよならを言います'
    const analysis = analyzeSongwriting({ language: 'Japanese', title: 'あと一分', hook: 'あと一分だけここにいて', lyrics })
    expect(parseSongSections(lyrics, 'J-pop').map((section) => section.kind)).toEqual(['verse', 'pre-chorus', 'chorus', 'bridge'])
    expect(analysis.language).toBe('ja-JP')
    expect(analysis.detectedHook).toBe('あと一分だけここにいて')
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('僕') && suggestion.includes('私'))).toBe(true)
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('polite'))).toBe(true)
    expect(analysis.scores.imagery).toBeGreaterThan(20)
  })

  it('builds a Japanese brief with native structure and mora guidance', () => {
    const prompt = buildSongwritingPrompt({ ...emptySongwritingDraft('日本語'), genre: 'anime opening', idea: 'A courier races the sunrise to deliver one forgotten letter' })
    expect(prompt).toContain('Japanese (J-pop)')
    expect(prompt).toContain('Aメロ')
    expect(prompt).toContain('morae')
    expect(prompt).toContain('ラスサビ')
  })

  it('translates native Korean control tags without changing sung bilingual lyrics', () => {
    const lyrics = `[인트로]
Black screen, blue light
네 이름이 또 번져 와

[벌스 1]
꺼진 화면만 바라본 밤

[프리코러스 2]
내가 만든 빛을 따라가

[랩 벌스]
No rewind, no reply, 오늘 끊어

[댄스 브레이크]
Cut it, cut it, cut the line

[마지막 후렴]
I see me, I see me, I'm standing here

[아웃트로]
I found my own afterglow`
    expect(prepareLyricsForGenerator(lyrics)).toBe(`[Intro]
Black screen, blue light
네 이름이 또 번져 와

[Verse 1]
꺼진 화면만 바라본 밤

[Pre-Chorus 2]
내가 만든 빛을 따라가

[Rap Verse]
No rewind, no reply, 오늘 끊어

[Dance Break]
Cut it, cut it, cut the line

[Final Chorus]
I see me, I see me, I'm standing here

[Outro]
I found my own afterglow`)
  })
})
