import { Cpu, Download, HardDrive, Play, Power, Sparkles, Square, Trash2, WandSparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AceStepGeneration, AceStepProgress, AceStepState } from '../domain/aceStep'
import { formatBytes } from '../domain/instruments'
import type { SongwritingDraft } from '../songwriting/types'

interface Props {
  state: AceStepState
  close(): void
  refresh(): Promise<void>
  onGenerated(generation: AceStepGeneration): Promise<void>
  notify(message: string, tone?: 'info' | 'error' | 'success'): void
  draft?: SongwritingDraft
}

const STARTER_PROMPTS = [
  { name: 'Neon Raga', prompt: 'Cinematic Indian electronica, expressive bansuri flute, deep tabla groove, warm analog bass, shimmering synth arpeggios, dramatic build, sophisticated and emotional, instrumental' },
  { name: 'Midnight Drive', prompt: 'Luxurious nocturnal synthwave, pulsing bass, crisp electronic drums, glassy pads, memorable lead melody, cinematic city lights, polished instrumental production' },
  { name: 'Velvet Orbit', prompt: 'Modern orchestral trip-hop, intimate piano, soaring strings, textured downtempo drums, sub bass, mysterious space atmosphere, emotional instrumental soundtrack' },
]

export function AceStepStudioModal({ state, close, refresh, onGenerated, notify, draft }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<AceStepProgress | null>(null)
  const [title, setTitle] = useState(draft?.title || 'Neon Raga')
  const [prompt, setPrompt] = useState(draft?.stylePrompt || STARTER_PROMPTS[0].prompt)
  const [duration, setDuration] = useState(30)
  const [bpm, setBpm] = useState(108)
  const [instrumental, setInstrumental] = useState(!draft?.lyrics.trim())
  const [lyrics, setLyrics] = useState(draft?.lyrics || '[Verse]\nA new sound wakes beneath the city lights\n\n[Chorus]\nWe move together through the endless night')

  useEffect(() => window.resonantDesktop?.onAceStepProgress(setProgress), [])

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label); setProgress(null)
    try { await action(); await refresh(); notify(`${label} completed.`, 'success') }
    catch (error) { notify(error instanceof Error ? error.message : `${label} failed.`, 'error') }
    finally { setBusy(null) }
  }

  const generate = async () => {
    if (!prompt.trim()) { notify('Describe the music you want to generate.', 'error'); return }
    setBusy('ACE-Step generation'); setProgress(null)
    try {
      const generation = await window.resonantDesktop!.generateWithAceStep({ title, prompt, duration, bpm, instrumental, lyrics: instrumental ? '' : lyrics, language: 'en' })
      await onGenerated(generation)
      await refresh()
      notify(`${generation.name} was generated and placed on the Audio track.`, 'success')
    } catch (error) { notify(error instanceof Error ? error.message : 'ACE-Step generation failed.', 'error') }
    finally { setBusy(null) }
  }

  const progressPercent = progress?.total ? Math.round(progress.received / progress.total * 100) : null

  return <div className="modal-backdrop ace-backdrop" role="dialog" aria-modal="true" aria-labelledby="ace-title">
    <section className="ace-studio-modal">
      <header>
        <div><span className="eyebrow">LOCAL GENERATIVE MUSIC</span><h2 id="ace-title"><WandSparkles size={22} /> ACE-Step Studio</h2><p>Generate original audio locally, then arrange and mix it inside Resonant.</p></div>
        <button className="modal-close" aria-label="Close ACE-Step Studio" onClick={close}><X size={19} /></button>
      </header>

      <div className="ace-status-strip">
        <span className={state.installed ? 'ready' : ''}><Download size={14} /><strong>{state.installed ? 'INSTALLED' : 'OPTIONAL'}</strong></span>
        <span className={state.running ? 'ready' : ''}><Power size={14} /><strong>{state.running ? 'RUNNING' : 'STOPPED'}</strong></span>
        <span><HardDrive size={14} /><strong>{formatBytes(state.bytes)}</strong></span>
        <span><Cpu size={14} /><strong>8 GB VRAM PROFILE</strong></span>
        <code title={state.root}>{state.root}</code>
      </div>

      {!state.installed ? <div className="ace-install-panel">
        <div className="ace-orbit"><Sparkles size={26} /></div>
        <div><span className="eyebrow">OPTIONAL POST-INSTALL MODULE</span><h3>Give Resonant a local imagination engine.</h3><p>Installs ACE-Step 1.5, its isolated Python runtime, and shared models once. Model files stay outside projects and can be removed independently.</p>
          <div className="ace-requirements"><span>About 10–20 GB</span><span>RTX 4060 optimized</span><span>No subscription</span><span>Works offline after setup</span></div>
        </div>
        <button disabled={!!busy} className="ace-primary" onClick={() => void run('ACE-Step installation', () => window.resonantDesktop!.installAceStep())}><Download size={17} /> {busy ? 'INSTALLING…' : 'INSTALL ACE-STEP 1.5'}</button>
      </div> : <div className="ace-workspace">
        <aside>
          <span className="eyebrow">CREATIVE STARTERS</span>
          {STARTER_PROMPTS.map((starter) => <button key={starter.name} className={title === starter.name ? 'active' : ''} onClick={() => { setTitle(starter.name); setPrompt(starter.prompt) }}><Sparkles size={14} /><span><strong>{starter.name}</strong><small>{starter.prompt.split(',').slice(0, 3).join(' · ')}</small></span></button>)}
          <div className="ace-runtime-card"><strong>{state.profile.dit}</strong><span>{state.profile.languageModel}</span><small>PyTorch · CPU offload · batch 1</small></div>
        </aside>
        <form onSubmit={(event) => { event.preventDefault(); void generate() }}>
          <label>TRACK NAME<input value={title} maxLength={90} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>MUSIC DIRECTION<textarea value={prompt} maxLength={2000} rows={5} onChange={(event) => setPrompt(event.target.value)} /></label>
          <div className="ace-field-row"><label>DURATION<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={20}>20 seconds</option><option value={30}>30 seconds</option><option value={45}>45 seconds</option><option value={60}>60 seconds</option></select></label><label>TEMPO<input type="number" min={30} max={300} value={bpm} onChange={(event) => setBpm(Number(event.target.value))} /></label></div>
          <label className="ace-check"><input type="checkbox" checked={instrumental} onChange={(event) => setInstrumental(event.target.checked)} /><span><strong>Instrumental</strong><small>Turn off to provide structured lyrics</small></span></label>
          {!instrumental && <label>LYRICS<textarea value={lyrics} maxLength={6000} rows={5} onChange={(event) => setLyrics(event.target.value)} /></label>}
          <button className="ace-generate" disabled={!!busy}><WandSparkles size={18} /> {busy ? 'CREATING LOCALLY…' : 'GENERATE & ADD TO AUDIO TRACK'}</button>
        </form>
      </div>}

      {progress && <div className="ace-progress"><span>{progress.label}</span><progress max={progress.total || 1} value={progress.received} /><output>{progressPercent === null ? progress.phase.toUpperCase() : `${progressPercent}%`}</output></div>}
      <footer>
        <span>{state.installed ? `${state.outputs.length} generated file${state.outputs.length === 1 ? '' : 's'} in shared output storage` : 'Nothing is downloaded until you choose Install'}</span>
        <div>{state.installed && <><button disabled={!!busy} onClick={() => void run(state.running ? 'ACE-Step shutdown' : 'ACE-Step startup', () => state.running ? window.resonantDesktop!.stopAceStep() : window.resonantDesktop!.startAceStep())}>{state.running ? <Square size={13} /> : <Play size={13} />}{state.running ? 'STOP ENGINE' : 'START ENGINE'}</button><button className="danger" disabled={!!busy} onClick={() => { if (window.confirm('Remove the ACE-Step runtime, models, cache, and generated previews? Resonant projects remain intact.')) void run('ACE-Step removal', () => window.resonantDesktop!.removeAceStep()) }}><Trash2 size={13} /> REMOVE</button></>}<button onClick={close}>DONE</button></div>
      </footer>
    </section>
  </div>
}
