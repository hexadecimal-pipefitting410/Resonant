import { BookOpenText, Check, Clipboard, Gauge, Languages, Music2, PenLine, Save, Sparkles, WandSparkles, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { analyzeSongwriting, applyStructureTemplate, buildSongwritingPrompt } from '../songwriting/core'
import type { SongwritingDraft, SongwritingLanguagePack } from '../songwriting/types'

interface Props {
  draft: SongwritingDraft
  languages: SongwritingLanguagePack[]
  close(): void
  save(draft: SongwritingDraft): void
  sendToGenerator(draft: SongwritingDraft): void
  notify(message: string, tone?: 'info' | 'error' | 'success'): void
}

const scoreTone = (score: number) => score >= 75 ? 'strong' : score >= 50 ? 'developing' : 'needs-work'

export function SongwriterStudioModal({ draft: initialDraft, languages, close, save, sendToGenerator, notify }: Props) {
  const [draft, setDraft] = useState(() => structuredClone(initialDraft))
  const [view, setView] = useState<'brief' | 'lyrics'>('brief')
  const lyricsRef = useRef<HTMLTextAreaElement>(null)
  const pack = languages.find((candidate) => candidate.id === draft.language) ?? languages[0]
  const quickSections = pack.quickSections ?? ['Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro']
  const analysis = useMemo(() => analyzeSongwriting(draft), [draft])
  const update = <K extends keyof SongwritingDraft>(key: K, value: SongwritingDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(buildSongwritingPrompt(draft))
      notify('A complete writing brief was copied. Paste it into your connected Resonant agent.', 'success')
    } catch { notify('The writing brief could not be copied.', 'error') }
  }

  const insertSection = (label: string) => {
    const textarea = lyricsRef.current
    const start = textarea?.selectionStart ?? draft.lyrics.length
    const prefix = start && !draft.lyrics.slice(0, start).endsWith('\n\n') ? '\n\n' : ''
    const addition = `${prefix}[${label}]\n`
    update('lyrics', `${draft.lyrics.slice(0, start)}${addition}${draft.lyrics.slice(start)}`)
    requestAnimationFrame(() => { textarea?.focus(); textarea?.setSelectionRange(start + addition.length, start + addition.length) })
  }

  const commit = () => { save(draft); notify('Songwriting draft saved inside this Resonant project.', 'success') }

  return <div className="modal-backdrop songwriter-backdrop" role="dialog" aria-modal="true" aria-labelledby="songwriter-title">
    <section className="songwriter-modal">
      <header>
        <div><span className="eyebrow">SONG DEVELOPMENT</span><h2 id="songwriter-title"><PenLine size={22} /> Songwriter Studio</h2><p>Shape the promise, story, hook, prosody, and generator direction before rendering a note.</p></div>
        <div className="songwriter-language"><Languages size={14} /><label>LANGUAGE<select value={draft.language} onChange={(event) => update('language', event.target.value)}>{languages.map((language) => <option key={language.id} value={language.id}>{language.name}</option>)}</select></label></div>
        <button className="modal-close" aria-label="Close Songwriter Studio" onClick={close}><X size={19} /></button>
      </header>

      <nav className="songwriter-tabs" aria-label="Songwriter views"><button className={view === 'brief' ? 'active' : ''} onClick={() => setView('brief')}><BookOpenText size={14} /> SONG DNA</button><button className={view === 'lyrics' ? 'active' : ''} onClick={() => setView('lyrics')}><Music2 size={14} /> LYRICS & CRAFT</button><span>{pack.description}</span></nav>

      <div className="songwriter-body">
        {view === 'brief' ? <>
          <main className="songwriter-brief">
            <div className="songwriter-field-row"><label>TITLE / WORKING TITLE<input value={draft.title} maxLength={200} placeholder="The phrase listeners remember" onChange={(event) => update('title', event.target.value)} /></label><label>CENTRAL HOOK<input value={draft.hook} maxLength={500} placeholder="A short repeatable payoff" onChange={(event) => update('hook', event.target.value)} /></label></div>
            <label>THE SONG'S ONE PROMISE<textarea value={draft.idea} maxLength={4000} rows={4} placeholder="What happens, to whom, and why does it matter now? Example: On the night before moving away, two friends avoid saying goodbye while packing the last box." onChange={(event) => update('idea', event.target.value)} /></label>
            <div className="songwriter-field-row triple"><label>GENRE<input value={draft.genre} maxLength={300} placeholder="Indie pop" onChange={(event) => update('genre', event.target.value)} /></label><label>EMOTIONAL COLOR<input value={draft.mood} maxLength={300} placeholder="Tender, restless" onChange={(event) => update('mood', event.target.value)} /></label><label>WHO IS IT FOR?<input value={draft.audience} maxLength={1000} placeholder="A friend who stayed" onChange={(event) => update('audience', event.target.value)} /></label></div>
            <div className="songwriter-field-row triple"><label>POINT OF VIEW<select value={draft.pointOfView} onChange={(event) => update('pointOfView', event.target.value as SongwritingDraft['pointOfView'])}><option value="first-person">I / me</option><option value="second-person">You</option><option value="collective">We / us</option><option value="third-person">He / she / they</option></select></label><label>TENSE<select value={draft.tense} onChange={(event) => update('tense', event.target.value as SongwritingDraft['tense'])}><option value="present">Present</option><option value="past">Past</option><option value="future">Future</option><option value="mixed">Deliberate mix</option></select></label><label>LANGUAGE PACK<input value={`${pack.name} · ${pack.locale}`} disabled /></label></div>
            <label>IMAGE BANK<textarea value={draft.imagery} maxLength={3000} rows={3} placeholder="Objects, places, colors, textures, weather, sounds: cardboard dust, blue tape, 2 a.m. kettle, empty nail in the wall…" onChange={(event) => update('imagery', event.target.value)} /></label>
            <label>PRODUCTION DIRECTION<textarea value={draft.stylePrompt} maxLength={2000} rows={3} placeholder="Intimate alternative pop, 92 BPM, close vocal, dry piano verses, widening drums and stacked harmonies in the chorus…" onChange={(event) => update('stylePrompt', event.target.value)} /></label>
          </main>
          <aside className="songwriter-structures"><span className="eyebrow">STRUCTURE BLUEPRINTS</span><p>Choose a form. Existing text survives when section names match.</p>{pack.templates.map((template) => <button key={template.id} onClick={() => { setDraft((current) => applyStructureTemplate(current, template.id)); setView('lyrics') }}><strong>{template.name}</strong><small>{template.description}</small><span>{template.sections.join(' → ')}</span></button>)}</aside>
        </> : <>
          <main className="songwriter-editor">
            <div className="section-tools"><span>INSERT SECTION</span>{quickSections.map((label) => <button key={label} onClick={() => insertSection(label)}>+ {label}</button>)}</div>
            <textarea ref={lyricsRef} aria-label="Song lyrics" value={draft.lyrics} maxLength={20000} spellCheck placeholder={pack.lyricPlaceholder ?? '[Verse 1]\nPut the listener inside a specific moment…\n\n[Chorus]\nDeliver the title and central emotional promise…'} onChange={(event) => update('lyrics', event.target.value)} />
            <div className="lyrics-stats"><span>{analysis.counts.words} WORDS</span><span>{analysis.counts.lines} LINES</span><span>{analysis.counts.sections} SECTIONS</span><span>{analysis.counts.repeatedLines} REPEATED LINES</span></div>
          </main>
          <aside className="songwriter-coach">
            <div className="coach-score"><Gauge size={17} /><span><strong>{analysis.scores.overall}</strong><small>CRAFT SIGNAL</small></span><p>This is guidance, not a verdict. A surprising line can break every rule and still win.</p></div>
            <div className="score-grid">{Object.entries(analysis.scores).filter(([name]) => name !== 'overall').map(([name, score]) => <div key={name}><span>{name.toUpperCase()}</span><strong className={scoreTone(score)}>{score}</strong><progress max={100} value={score} /></div>)}</div>
            <div className="coach-notes"><span className="eyebrow">NEXT REVISION</span>{analysis.suggestions.slice(0, 4).map((suggestion) => <p key={suggestion}><Sparkles size={12} />{suggestion}</p>)}{analysis.strengths.slice(0, 2).map((strength) => <p className="strength" key={strength}><Check size={12} />{strength}</p>)}</div>
            {analysis.sections.length > 0 && <div className="section-meter"><span className="eyebrow">SECTION PROSODY</span>{analysis.sections.map((section, index) => <div key={`${section.label}-${index}`}><strong>{section.label}</strong><span>{section.linesAnalysis.map((line) => line.syllables).join(' · ') || 'empty'}</span><small>{section.rhymeScheme || '—'}</small></div>)}</div>}
          </aside>
        </>}
      </div>

      <footer><span>{languages.length} replaceable language packs installed: {languages.map((language) => language.name).join(', ')}.</span><div><button onClick={() => void copyBrief()}><Clipboard size={13} /> COPY AGENT BRIEF</button><button onClick={commit}><Save size={13} /> SAVE DRAFT</button><button className="songwriter-generate" disabled={!draft.lyrics.trim() || !draft.stylePrompt.trim()} onClick={() => { save(draft); sendToGenerator(draft) }}><WandSparkles size={14} /> SEND TO ACE-STEP</button><button onClick={close}>DONE</button></div></footer>
    </section>
  </div>
}
