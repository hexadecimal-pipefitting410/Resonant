import { AudioLines, Info, Library, Mic2, SlidersHorizontal, Upload } from 'lucide-react'
import { touch } from '../domain/project'
import type { InstrumentLibraryState } from '../domain/instruments'
import type { Clip, Track } from '../domain/types'
import { useAppStore } from '../store/AppStore'

export function Inspector({ selectedTrack, selectedClip, importAudio, library, openLibrary }: { selectedTrack: Track; selectedClip?: Clip; importAudio(): void; library: InstrumentLibraryState; openLibrary(): void }) {
  const store = useAppStore()
  const updateTrack = (patch: Partial<Track>, label: string) => store.commit(touch({ ...store.project, tracks: store.project.tracks.map((track) => track.id === selectedTrack.id ? { ...track, ...patch } : track) }), label)
  const updateClip = (patch: Partial<Clip>, label: string) => {
    if (!selectedClip) return
    store.commit(touch({ ...store.project, clips: { ...store.project.clips, [selectedClip.id]: { ...selectedClip, ...patch } as Clip } }), label)
  }
  const block = store.project.arrangement.find((candidate) => candidate.id === store.selectedBlockId)
  return <aside className="inspector" aria-label="Inspector">
    <div className="panel-heading"><span>INSPECTOR</span><SlidersHorizontal size={14} /></div>
    <section className="inspector-section track-inspector"><div className="inspector-title"><span style={{ background: selectedTrack.color }} /><div><small>TRACK</small><input aria-label="Track name" value={selectedTrack.name} onChange={(event) => updateTrack({ name: event.target.value.slice(0, 28) }, 'Rename track')} /></div></div>
      <div className="mini-switches"><button className={selectedTrack.mute ? 'active mute' : ''} onClick={() => updateTrack({ mute: !selectedTrack.mute }, 'Toggle mute')}>MUTE</button><button className={selectedTrack.solo ? 'active solo' : ''} onClick={() => updateTrack({ solo: !selectedTrack.solo }, 'Toggle solo')}>SOLO</button>{selectedTrack.kind === 'audio' && <button className={selectedTrack.armed ? 'active arm' : ''} onClick={() => updateTrack({ armed: !selectedTrack.armed }, 'Toggle arm')}><Mic2 size={12} /> {selectedTrack.armed ? 'ARMED' : 'ARM'}</button>}</div>
    </section>
    <section className="inspector-section"><h3><AudioLines size={14} /> SOUND</h3>
      {selectedTrack.kind !== 'audio' ? <>
        <label className="field-label">INSTRUMENT<select value={selectedTrack.instrument?.id ?? ''} onChange={(event) => {
          const instrument = library.instruments.find((candidate) => candidate.id === event.target.value)
          updateTrack(instrument ? { kind: instrument.percussion ? 'drum' : 'sampler', instrument: { id: instrument.id, name: instrument.name, packName: instrument.packName, format: instrument.format, program: instrument.program, bankMSB: instrument.bankMSB, bankLSB: instrument.bankLSB, percussion: instrument.percussion } } : { kind: selectedTrack.kind === 'drum' ? 'drum' : 'synth', instrument: undefined }, instrument ? 'Choose instrument' : 'Use synthesizer')
        }}><option value="">Built-in {selectedTrack.kind === 'drum' ? 'drum voice' : `${selectedTrack.waveform} synth`}</option>{[...library.instruments].sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name)).map((instrument) => <option key={instrument.id} value={instrument.id}>{instrument.family} · {instrument.name}{instrument.variant ? ` — ${instrument.variant}` : ''}</option>)}</select></label>
        <button className="wide-action library-action" onClick={openLibrary}><Library size={14} /> BROWSE / INSTALL INSTRUMENTS</button>
        {!selectedTrack.instrument && <label className="field-label">VOICE<select value={selectedTrack.waveform} onChange={(event) => updateTrack({ waveform: event.target.value as Track['waveform'] }, 'Change waveform')}><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="sawtooth">Saw</option><option value="square">Square</option></select></label>}
        <label className="slider-label"><span>ATTACK <output>{selectedTrack.attack.toFixed(2)}s</output></span><input type="range" min="0.002" max="1" step="0.002" value={selectedTrack.attack} onChange={(event) => updateTrack({ attack: Number(event.target.value) }, 'Change attack')} /></label>
        <label className="slider-label"><span>RELEASE <output>{selectedTrack.release.toFixed(2)}s</output></span><input type="range" min="0.03" max="2" step="0.01" value={selectedTrack.release} onChange={(event) => updateTrack({ release: Number(event.target.value) }, 'Change release')} /></label>
        <label className="slider-label"><span>FILTER <output>{selectedTrack.filterHz >= 1000 ? `${(selectedTrack.filterHz / 1000).toFixed(1)}k` : selectedTrack.filterHz} Hz</output></span><input type="range" min="180" max="16000" step="20" value={selectedTrack.filterHz} onChange={(event) => updateTrack({ filterHz: Number(event.target.value) }, 'Change filter')} /></label>
      </> : <button className="wide-action" onClick={importAudio}><Upload size={14} /> IMPORT AUDIO FILE</button>}
    </section>
    <section className="inspector-section"><h3><SlidersHorizontal size={14} /> MIX</h3>
      <label className="slider-label"><span>LEVEL <output>{Math.round(selectedTrack.volume * 100)}%</output></span><input type="range" min="0" max="1.2" step="0.01" value={selectedTrack.volume} onChange={(event) => updateTrack({ volume: Number(event.target.value) }, 'Change track level')} /></label>
      <label className="slider-label"><span>PAN <output>{selectedTrack.pan === 0 ? 'CENTER' : selectedTrack.pan < 0 ? `${Math.round(-selectedTrack.pan * 100)} L` : `${Math.round(selectedTrack.pan * 100)} R`}</output></span><input type="range" min="-1" max="1" step="0.01" value={selectedTrack.pan} onDoubleClick={() => updateTrack({ pan: 0 }, 'Center pan')} onChange={(event) => updateTrack({ pan: Number(event.target.value) }, 'Change pan')} /></label>
      <label className="slider-label"><span>DELAY SEND <output>{Math.round(selectedTrack.delay * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value={selectedTrack.delay} onChange={(event) => updateTrack({ delay: Number(event.target.value) }, 'Change delay')} /></label>
    </section>
    {selectedClip && <section className="inspector-section"><h3><span className="tiny-dot" style={{ background: selectedClip.color }} /> CLIP SOURCE</h3>
      <label className="field-label">NAME<input value={selectedClip.name} onChange={(event) => updateClip({ name: event.target.value.slice(0, 32) }, 'Rename clip')} /></label>
      <div className="property-grid"><span>TYPE<strong>{selectedClip.type.toUpperCase()}</strong></span><span>LENGTH<strong>{selectedClip.lengthBeats.toFixed(2)} BEATS</strong></span>{selectedClip.type === 'midi' ? <span>EVENTS<strong>{selectedClip.notes.length}</strong></span> : <span>AUDIO<strong>{(selectedClip.frames / selectedClip.sampleRate).toFixed(2)} SEC</strong></span>}</div>
      {selectedClip.type === 'audio' && <><label className="slider-label"><span>CLIP GAIN <output>{Math.round(selectedClip.gain * 100)}%</output></span><input type="range" min="0" max="2" step="0.01" value={selectedClip.gain} onChange={(event) => updateClip({ gain: Number(event.target.value) }, 'Change clip gain')} /></label><div className="trim-pair"><label>TRIM IN<input type="number" min="0" max={Math.max(0, selectedClip.frames / selectedClip.sampleRate - selectedClip.trimEnd - 1 / selectedClip.sampleRate)} step="0.01" value={selectedClip.trimStart} onChange={(event) => {
        const maximum = Math.max(0, selectedClip.frames / selectedClip.sampleRate - selectedClip.trimEnd - 1 / selectedClip.sampleRate)
        updateClip({ trimStart: Math.max(0, Math.min(maximum, Number(event.target.value) || 0)) }, 'Trim clip')
      }} /></label><label>TRIM OUT<input type="number" min="0" max={Math.max(0, selectedClip.frames / selectedClip.sampleRate - selectedClip.trimStart - 1 / selectedClip.sampleRate)} step="0.01" value={selectedClip.trimEnd} onChange={(event) => {
        const maximum = Math.max(0, selectedClip.frames / selectedClip.sampleRate - selectedClip.trimStart - 1 / selectedClip.sampleRate)
        updateClip({ trimEnd: Math.max(0, Math.min(maximum, Number(event.target.value) || 0)) }, 'Trim clip')
      }} /></label></div></>}
    </section>}
    {block && <section className="inspector-section"><h3>ARRANGEMENT INSTANCE</h3><div className="property-grid"><span>START<strong>BEAT {block.startBeat + 1}</strong></span><span>LENGTH<strong>{block.lengthBeats} BEATS</strong></span></div><p className="context-note"><Info size={13} /> This instance references the source above. Editing either updates every use.</p></section>}
    <section className="inspector-tip"><Info size={14} /><p><strong>Shared by design</strong>Clip edits flow into the launcher and every arrangement instance. Duplicate only when you want a variation.</p></section>
  </aside>
}
