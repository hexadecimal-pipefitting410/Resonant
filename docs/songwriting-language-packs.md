# Songwriting language packs

Resonant's Songwriter Studio separates universal workflow from language-specific craft. The shared engine owns draft persistence, section parsing, the desktop editor, MCP tools, generator handoff, and score presentation. A language pack owns only the knowledge that changes by language.

## Pack contract

Create `src/songwriting/languages/<id>.ts` and export a `SongwritingLanguagePack` with:

- a stable BCP-47-like ID, display name, and locale;
- common language names and native-name aliases so a context-free MCP agent can resolve user wording;
- culturally and linguistically appropriate structure templates;
- a syllable or mora estimator;
- a rhyme-key function suitable for that language's sound system;
- optional language-aware tokenization, native quick-section labels, and an editor placeholder;
- sensory vocabulary and cliché signals used as revision prompts;
- a concise coaching guide for the connected writing agent.

Register it once in `src/songwriting/registry.ts`. The desktop language selector, `list_songwriting_languages`, `analyze_lyrics`, `save_songwriting_draft`, and the `write_song` MCP prompt then discover it automatically.

## Quality rules

Language packs must not be word-for-word translations of the English pack. Test native orthography, code-switching behavior, section labels, sung prosody, and at least one genre-native structure. Heuristic scores are coaching signals, not quality judgments; expose uncertainty instead of inventing linguistic precision.

Add unit fixtures written or reviewed by a fluent speaker. Tests should cover syllable/rhyme behavior, Unicode lyrics, section parsing, and one intentionally weak draft that produces useful revision advice.

## Current packs

- `en`: modern English song form, approximate syllables and rhyme families, hook/imagery/originality signals, and four structure blueprints.
- `hi`: contemporary Hindi/Hindustani in Devanagari or deliberate Hinglish, approximate sung-akshara counting with final-schwa handling, sound-based rhyme, native mukhda/antara/सेतु labels, relationship-register review, poetry-drift warnings, and four genre-native structures.
- `zh-CN`: contemporary Standard Mandarin in Simplified Chinese, discoverable through names including Chinese, Mandarin, 中文, 普通话, 华语, and 国语; Hanzi syllable counting, `Intl.Segmenter` word grouping, Pinyin-final rhyme, Simplified/Traditional section-label recognition, social-register and code-switching review, soft tone–melody guidance, and six C-pop structures.
- `ko-KR`: contemporary Korean with Hangul-block meter, phonetic batchim normalization, medial-vowel-and-coda rhyme, Korean/English code-switching and speech-level review, native production labels, and six K-pop, K-R&B, hip-hop, band, and ballad structures.
- `es-419`: broadly accessible Latin American Spanish with diphthong/triphthong/hiatus-aware meter, stress-based rhyme, tú/vos/usted and regional-slang review, and distinct pop, reguetón, bachata, salsa, ballad, and regional Mexican forms.
- `ja-JP`: contemporary Japanese with mora counting, vowel-pattern rhyme, narrator/register and script review, Aメロ/Bメロ/サビ/Cメロ labels, and six J-pop, anime-opening, city-pop, J-rock, idol, and ballad structures.

### Hindi design basis

The Hindi pack treats written Devanagari and sung pronunciation as different layers because automatic prosody must account for schwa deletion. Its song forms follow the recurring mukhda and developing antara convention rather than translating Western labels word for word. Qaafiya and radeef are available as sound-and-refrain concepts, but the coaching deliberately avoids imposing formal ghazal rules on every Hindi pop or indie song. Hinglish is treated as a legitimate register when the narrator's code-switching is consistent.

Research starting points: [ACL schwa-deletion research](https://aclanthology.org/2020.acl-main.696/), [systematic Hindi prosody review](https://arxiv.org/abs/1705.03247), [Hindi film-song structure](https://doaj.org/article/d0250af8e4304eb5ad446facd6620607), [Rekhta poetry forms](https://www.rekhta.org/urdu-resources/forms-of-urdu-poetry), and [Hinglish in Indian popular culture](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.0083-2919.2006.00461.x).

### Mandarin Chinese design basis

The default is Standard Mandarin with Simplified Chinese (`zh-CN`), the broadest mainland-oriented written and sung target. “Chinese” and “Mandarin” resolve to this pack for convenience, but Cantonese, Hokkien, and region-specific Traditional Chinese writing conventions are not treated as dialect toggles; they need their own future packs and fluent review.

The pack models these practical layers:

- **Form:** contemporary Mandopop, narrative ballad, short hook pop, Mandarin hip-hop, 国风 fusion, and duet blueprints use native labels such as 主歌, 预副歌, 副歌, 桥段, and 尾声.
- **Rhythm:** Hanzi are counted as approximate sung syllables while language-aware segmentation keeps multi-character words visible. Character count is a fit signal, not a command to make every line identical.
- **Rhyme:** line endings are compared by toneless Pinyin finals (韵母). This captures pairs such as 光/窗 and 天/前 while leaving the lexical tones free to differ.
- **Tone and melody:** lexical tone is a soft intelligibility constraint. Critical hooks, names, ambiguous short words, and exposed line endings deserve sing-testing, but the pack does not force melody to trace every spoken tone.
- **Contemporary voice:** review favors natural Standard Mandarin, coherent 你/您 distance, concrete scenes, and deliberate code-switching. It warns when generic classical abstractions make an unintended poem; deliberate 国风 remains supported through a focused image system.

Research supports separating syllable count, rhyme, semantic consistency, and lyric–melody fit rather than collapsing them into one score. Mandarin lyric-generation work uses syllable structure and phrasal context; later agent-based work independently controls rhyme, syllable count, consistency, and melody fit. Tone research also cautions against a rigid rule: much modern Mandarin singing allows musical melody to override lexical contours, unlike more constrained tone-language traditions. Mandarin rap has its own line-ending tone distribution, so the rap blueprint treats cadence as genre-specific instead of imposing it on ballads.

Research starting points: [syllable-structured Chinese lyric generation](https://arxiv.org/abs/1906.09322), [agent-driven Mandarin lyric generation](https://arxiv.org/abs/2410.01450), [automatic song translation for tonal languages](https://aclanthology.org/2022.findings-acl.60/), [Mandarin tone and melody perception](https://pmc.ncbi.nlm.nih.gov/articles/PMC13035821/), [linguistic tone in Chinese rap](https://doi.org/10.1080/09298215.2024.2329075), [MIT overview of Pinyin and Mandarin rhymes](https://ocw.mit.edu/courses/res-21g-003-learning-chinese-a-foundation-course-in-mandarin-spring-2011/01af9a25b804b7d58a26fa580691df4f_MITRES_21G_003S11_pinyin.pdf), and the [pinyin-pro API used by the local analyzer](https://pinyin-pro.cn/en/use/pinyin.html).

### Korean / K-pop design basis

The Korean pack treats Hangul blocks as the practical sung unit. Its rhyme key decomposes a final block and compares the medial vowel plus the spoken coda class; this follows Korean rhyme work that models onset, medial, and final components rather than copying an English spelling rule. The reviewer treats English as a legitimate K-pop resource but asks whether each switch has a hook, rhythm, character, or semantic job.

The performance blueprint makes arrangement contrast explicit: 벌스, 프리코러스, 후렴, 포스트코러스, rap, dance break, bridge, and final return are available, but the guide tells agents to omit sections that do not serve the song. K-R&B, Korean hip-hop, band, and ballad templates intentionally behave differently from maximal idol pop. Speech-level consistency and Hangul performance copy are checked separately from style.

Research starting points: the [National Institute of Korean Language explanation of syllable-block construction](https://www.korean.go.kr/eng_hangeul/principle/001.html), [Korean rap rhyme research](https://pure.skku.edu/en/publications/rhyme-word-embedding-and-attentionfor-korean-rap-lyrics-generatio/), a [K-pop structural overview from MTNA](https://www.mtna.org/downloads/GP3/Handouts/2022/K-POP%20Presentation.pdf), and a [corpus study of Korean–English code-switching in globally charting K-pop](https://anthology.ach.org/volumes/vol0003/global-beats-local-tongue-studying-code-switching/).

### Latin American Spanish design basis

`es-419` is a practical default, not a claim that Latin America has one uniform voice. The guide begins broadly understandable, then asks the agent to choose a specific country or community whenever the brief supplies one. It reviews tú, vos, usted, ustedes/vosotros, and conflicting slang signals so the lyric does not drift between unrelated regions. The syllable estimator follows written vowel nuclei, including diphthongs, triphthongs, accented hiatus, and silent `u`; actual sung division remains a performance decision because geography and delivery can change it.

The six structures separate genuinely different writing jobs. Pop and reguetón emphasize a compact hook but use different cadence and arrangement logic. Bachata makes space for the guitar conversation. Salsa opens a composed cuerpo into coro–pregón call-and-response. Ballad prioritizes narrative transformation, and regional Mexican form requires named stakes and advancing story rather than stereotypes.

Research starting points: the [RAE/ASALE guide to diphthongs, triphthongs, and hiatus](https://www.rae.es/ortograf%C3%ADa-b%C3%A1sica/uso-de-la-tilde/las-reglas-de-acentuaci%C3%B3n-gr%C3%A1fica/la-acentuaci%C3%B3n-gr%C3%A1fica-de-las-palabras-con-secuencias-voc%C3%A1licas), the [Instituto Cervantes overview of American Spanish pronouns and voseo](https://cvc.cervantes.es/ensenanza/biblioteca_ele/carabela/pdf/50/50_021.pdf), [Berklee's description of Latin pop as a multi-genre field](https://college.berklee.edu/courses/sw-380), an [ethnomusicology study of mainstream reggaetón production](https://produccioncientifica.ucm.es/documentos/61dfc2aa1614d23558cce635?lang=en), and the [Smithsonian account of Afro-Puerto Rican narrative and call-and-response traditions](https://folkways.si.edu/los-pleneros-de-la-21-afro-puerto-rican-traditions/latin/music/article/smithsonian).

### Japanese / J-pop design basis

The Japanese pack measures morae (拍), not English-style syllables. Contracted small-kana combinations occupy one mora, while long vowels, っ, and ん still consume time. Kanji does not encode its reading, so the local analyzer conservatively counts each kanji as one fallback unit and the coaching guide explicitly requires the writer to count the intended reading aloud. Rhyme uses the last vowel/mora pattern and treats matching rhythm, syntax, internal echo, and keywords as first-class alternatives to Western end rhyme.

The standard blueprint follows the well-established Aメロ–Bメロ–サビ vocabulary, with Cメロ, 落ちサビ, and ラスサビ available for contrast and final scale. Separate anime-opening, city-pop, J-rock, idol, and ballad forms change scene density, response space, instrumental release, and vocal arc. The reviewer checks Japanese-script performance copy, first-person identity, speech register, cliché density, and intentional English use.

Research starting points: the [Japanese education guidance that っ, ん, and long vowels each count as one mora](https://www.nihongo-ews.mext.go.jp/contents_files/download/?cfid=56&content_id=172), the [University of Tsukuba study of Aメロ, Bメロ, and サビ identification](https://www.slis.tsukuba.ac.jp/grad/assets/files/pub-2/2019/39.final_201821634_abstract.pdf), a [Japanese lyric-writing support system built around morae, vowels, and accent](https://www.apsipa.org/proceedings_2012/papers/120.pdf), and [research on English/Japanese language mixing in J-pop](https://www.lunduniversity.lu.se/publication/4451819).

## Agent discovery contract

A context-free MCP agent must call `get_capabilities` first and then `list_songwriting_languages` for every lyric or song request. The latter returns each canonical ID, locale, common aliases, native templates, and its complete coaching guide. The `write_song` prompt accepts an ID or alias and canonicalizes it before drafting—for example, `Chinese` selects `zh-CN`, `K-pop` selects `ko-KR`, `Latino` selects `es-419`, `J-pop` selects `ja-JP`, and native names such as `हिंदी`, `中文`, `한국어`, `Español`, and `日本語` work as well. `analyze_lyrics` and `save_songwriting_draft` accept the same aliases; saved projects always store the canonical ID.

This contract is enforced in unit tests, the real STDIO MCP smoke test, and the desktop smoke test. Together they cover all six packs, alias resolution, guide visibility, prompt generation, native section parsing, canonical saves, and context-free requests in English and native naming.
