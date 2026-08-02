import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { AudioWaveform, Rows3, Copy, Eraser, Play, Plus, Square, Volume2 } from 'lucide-react'
import type { EngineState, MidiClip } from '../domain/types'
import { makeId, touch } from '../domain/project'
import { useAppStore } from '../store/AppStore'
import { liveEngine } from '../audio/LiveEngine'

interface Props {
  engine: EngineState
  setEngine: Dispatch<SetStateAction<EngineState>>
  notify(message: string, tone?: 'info' | 'error' | 'success'): void
  importAudio(): void
  captureSession(): void
}

const noteName = (pitch: number) => `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][pitch % 12]}${Math.floor(pitch / 12) - 1}`
const drumName = (pitch: number) => ({ 36: 'KICK', 38: 'SNARE', 42: 'CLOSED HAT', 46: 'OPEN HAT' } as Record<number, string>)[pitch] ?? `DRUM ${pitch}`

export function FlowView({ engine, setEngine, notify, importAudio, captureSession }: Props) {
  const store = useAppStore()
  const [selectedNote, setSelectedNote] = useState<string | null>(null)
  const selectedTrack = store.project.tracks.find((track) => track.id === store.selectedTrackId) ?? store.project.tracks[0]
  const selectedClip = store.selectedClipId ? store.project.clips[store.selectedClipId] : undefined

  const launch = (trackId: string, clipId: string | null) => {
    setEngine((state) => ({ ...state, mode: 'session', activeClips: { ...state.activeClips, [trackId]: clipId } }))
    if (clipId) store.selectTrack(trackId, clipId)
  }
  const launchScene = (scene: number) => {
    const active = { ...engine.activeClips }
    store.project.tracks.forEach((track) => { if (track.sessionSlots[scene]) active[track.id] = track.sessionSlots[scene] })
    setEngine((state) => ({ ...state, mode: 'session', activeClips: active }))
    notify(`Scene ${scene + 1} queued on the beat.`, 'success')
  }

  const updateMidi = (updater: (clip: MidiClip) => MidiClip, label: string) => {
    if (!selectedClip || selectedClip.type !== 'midi') return
    const clip = updater(structuredClone(selectedClip))
    store.commit(touch({ ...store.project, clips: { ...store.project.clips, [clip.id]: clip } }), label)
  }
  const toggleNote = (step: number, pitch: number) => updateMidi((clip) => {
    const existing = clip.notes.find((note) => note.step === step && note.pitch === pitch)
    if (existing) { clip.notes = clip.notes.filter((note) => note.id !== existing.id); setSelectedNote(null) }
    else { const note = { id: makeId('note'), step, pitch, velocity: step % 4 === 0 ? 0.92 : 0.72, durationSteps: selectedTrack.kind === 'drum' ? 1 : 2 }; clip.notes.push(note); setSelectedNote(note.id) }
    return clip
  }, 'Edit note')
  const changeVelocity = (value: number) => updateMidi((clip) => {
    clip.notes = clip.notes.map((note) => note.id === selectedNote ? { ...note, velocity: value } : note); return clip
  }, 'Change velocity')
  const updateAutomation = (step: number, value: number) => updateMidi((clip) => { clip.volumeAutomation[step] = value; return clip }, 'Draw automation')

  const pitches = useMemo(() => {
    if (selectedTrack.kind === 'drum') return [46, 42, 38, 36]
    return Array.from({ length: 13 }, (_, index) => 72 - index)
  }, [selectedTrack.kind, selectedTrack.name])
  const activeNote = selectedClip?.type === 'midi' ? selectedClip.notes.find((note) => note.id === selectedNote) : undefined

  return <div className="flow-view">
    <section className="session-panel">
      <div className="section-heading"><div><span className="eyebrow">LIVE CANVAS</span><h2>Clip field</h2></div><div className="section-actions"><button onClick={captureSession}><Rows3 size={14} /> CAPTURE 4 BARS</button></div></div>
      <div className="session-grid" style={{ gridTemplateColumns: `70px repeat(${store.project.tracks.length}, minmax(112px, 1fr))` }}>
        <div className="session-corner">SCENES</div>{store.project.tracks.map((track) => <div className="session-track-head" key={track.id}><span style={{ background: track.color }} />{track.name}<button aria-label={`Stop ${track.name}`} title={`Stop ${track.name}`} onClick={() => launch(track.id, null)}><Square size={10} fill="currentColor" /></button></div>)}
        {[0, 1, 2, 3].map((scene) => <div className="session-row" key={scene} style={{ display: 'contents' }}>
          <button className="scene-launch" onClick={() => launchScene(scene)}><Play size={11} fill="currentColor" /> {String(scene + 1).padStart(2, '0')}</button>
          {store.project.tracks.map((track) => {
            const clipId = track.sessionSlots[scene], clip = clipId ? store.project.clips[clipId] : undefined
            const active = !!clipId && engine.activeClips[track.id] === clipId
            const selected = !!clipId && store.selectedClipId === clipId
            return clip ? <button key={track.id} className={`clip-cell ${active ? 'active' : ''} ${selected ? 'selected' : ''}`} style={{ '--clip-color': clip.color } as React.CSSProperties} onClick={() => { store.selectTrack(track.id, clip.id); launch(track.id, clip.id) }}>
              <span className="clip-accent" /><strong>{clip.name}</strong><small>{clip.type === 'midi' ? `${clip.notes.length} notes · ${clip.lengthBeats} beats` : `${(clip.frames / clip.sampleRate).toFixed(1)} sec · audio`}</small>{active && <i><Volume2 size={11} /> LIVE</i>}
            </button> : <button key={track.id} className="clip-cell empty" onClick={() => { store.selectTrack(track.id, null); if (track.kind === 'audio') importAudio() }}><Plus size={14} /><span>{track.kind === 'audio' ? 'IMPORT / RECORD' : 'EMPTY SLOT'}</span></button>
          })}
        </div>)}
      </div>
    </section>

    <section className="editor-panel">
      <div className="editor-head"><div><span className="clip-dot" style={{ background: selectedClip?.color ?? '#555' }} /><div><span className="eyebrow">SOURCE EDITOR · SHARED EVERYWHERE</span><h2>{selectedClip?.name ?? 'Choose a clip'}</h2></div></div>{selectedClip?.type === 'midi' && <div className="editor-tools"><span>1/16</span><button title="Duplicate clip source" onClick={() => {
        const id = makeId('clip'), copy = { ...structuredClone(selectedClip), id, name: `${selectedClip.name} copy` }
        const slots = [...selectedTrack.sessionSlots], slot = slots.findIndex((item) => !item); slots[slot < 0 ? 3 : slot] = id
        store.commit(touch({ ...store.project, clips: { ...store.project.clips, [id]: copy }, tracks: store.project.tracks.map((track) => track.id === selectedTrack.id ? { ...track, sessionSlots: slots } : track) }), 'Duplicate clip'); store.selectClip(id)
      }}><Copy size={14} /> DUPLICATE</button><button onClick={() => updateMidi((clip) => ({ ...clip, notes: [] }), 'Clear clip')}><Eraser size={14} /> CLEAR</button></div>}</div>
      {!selectedClip && <div className="empty-editor"><AudioWaveform size={30} /><h3>No clip selected</h3><p>Choose a source above to edit it. Arrangement instances will follow your changes.</p></div>}
      {selectedClip?.type === 'audio' && <div className="audio-editor"><div className="waveform" aria-label="Audio waveform preview">{(selectedClip.waveformPeaks ?? []).map((peak, index) => <i key={index} style={{ height: `${Math.max(3, peak * 100)}%` }} />)}{!selectedClip.waveformPeaks?.length && <span>Waveform unavailable for this older clip</span>}</div><div className="audio-summary"><span>{selectedClip.channels === 2 ? 'STEREO' : 'MONO'}</span><span>{(selectedClip.sampleRate / 1000).toFixed(1)} KHZ</span><span>{(selectedClip.frames / selectedClip.sampleRate).toFixed(2)} SEC</span><span>{selectedClip.asset ? 'SHARED ASSET' : 'EMBEDDED'}</span></div></div>}
      {selectedClip?.type === 'midi' && <>
        <div className={`piano-grid ${selectedTrack.kind === 'drum' ? 'drum-grid' : ''}`} style={{ gridTemplateRows: `repeat(${pitches.length}, minmax(${selectedTrack.kind === 'drum' ? 50 : 20}px, 1fr))` }}>
          {pitches.map((pitch) => <div className="piano-row" key={pitch}><button className={`note-label ${pitch % 12 === 0 ? 'root' : ''}`} onClick={() => {
            void liveEngine.audition(store.project, selectedTrack, pitch).catch(() => undefined)
          }}>{selectedTrack.kind === 'drum' ? drumName(pitch) : noteName(pitch)}</button><div className="step-row">{Array.from({ length: 16 }, (_, step) => {
            const note = selectedClip.notes.find((candidate) => candidate.step === step && candidate.pitch === pitch)
            return <button key={step} aria-label={`${note ? 'Remove' : 'Add'} ${noteName(pitch)} at step ${step + 1}`} className={`${note ? 'on' : ''} ${note?.id === selectedNote ? 'selected' : ''} ${step % 4 === 0 ? 'beat' : ''}`} style={{ '--velocity': note?.velocity ?? 0, '--clip-color': selectedClip.color } as React.CSSProperties} onClick={() => toggleNote(step, pitch)} onContextMenu={(event) => { event.preventDefault(); if (note) { setSelectedNote(note.id); changeVelocity(Math.max(0.1, note.velocity - 0.1)) } }}><span /></button>
          })}</div></div>)}
          <div className="grid-playhead" style={{ left: `calc(64px + (100% - 64px) * ${(engine.beat % selectedClip.lengthBeats) / selectedClip.lengthBeats})` }} />
        </div>
        <div className="automation-editor"><div className="automation-label"><span>VOLUME</span><small>CLIP MOTION</small></div><div className="automation-bars">{selectedClip.volumeAutomation.map((value, step) => <button key={step} title={`Step ${step + 1}: ${Math.round(value * 100)}%`} onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect(); updateAutomation(step, Math.max(0.05, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)))
        }}><i style={{ height: `${value * 100}%`, background: selectedClip.color }} /></button>)}</div><div className="velocity-control"><label>NOTE VELOCITY <strong>{activeNote ? Math.round(activeNote.velocity * 100) : '—'}</strong></label><input disabled={!activeNote} aria-label="Selected note velocity" type="range" min="0.1" max="1" step="0.01" value={activeNote?.velocity ?? 0.7} onChange={(event) => changeVelocity(Number(event.target.value))} /></div></div>
      </>}
    </section>
  </div>
}
