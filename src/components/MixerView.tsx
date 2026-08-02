import { Headphones, RotateCcw, SlidersHorizontal, Volume2 } from 'lucide-react'
import { touch } from '../domain/project'
import type { Track } from '../domain/types'
import { useAppStore } from '../store/AppStore'

export function MixerView() {
  const store = useAppStore()
  const updateTrack = (trackId: string, patch: Partial<Track>, label: string) => store.commit(touch({ ...store.project, tracks: store.project.tracks.map((track) => track.id === trackId ? { ...track, ...patch } : track) }), label)
  return <div className="mix-view">
    <div className="section-heading"><div><span className="eyebrow">SIGNAL + SPACE</span><h2>Mixer</h2></div><div className="mix-note"><SlidersHorizontal size={14} /> Stereo master · soft limiter</div></div>
    <div className="mixer-scroll"><div className="mixer-channels">
      {store.project.tracks.map((track, index) => <article className={`channel-strip ${store.selectedTrackId === track.id ? 'selected' : ''}`} key={track.id} onClick={() => store.selectTrack(track.id, track.sessionSlots.find(Boolean) ?? null)}>
        <header><span className="channel-color" style={{ background: track.color }} /><small>{String(index + 1).padStart(2, '0')}</small><strong>{track.name}</strong></header>
        <div className="channel-source"><span>{track.kind.toUpperCase()}</span><strong>{track.instrument?.name ?? (track.kind === 'synth' ? track.waveform : track.kind === 'drum' ? 'VOICE' : track.armed ? 'INPUT ARMED' : 'DEFAULT INPUT')}</strong></div>
        <div className="knob-group"><label><span>PAN</span><output>{track.pan === 0 ? 'C' : track.pan < 0 ? `${Math.round(-track.pan * 100)}L` : `${Math.round(track.pan * 100)}R`}</output><input aria-label={`${track.name} pan`} type="range" min="-1" max="1" step="0.01" value={track.pan} onDoubleClick={() => updateTrack(track.id, { pan: 0 }, 'Center pan')} onChange={(event) => updateTrack(track.id, { pan: Number(event.target.value) }, 'Change pan')} /></label>
          <label><span>DELAY SEND</span><output>{Math.round(track.delay * 100)}</output><input aria-label={`${track.name} delay send`} type="range" min="0" max="1" step="0.01" value={track.delay} onChange={(event) => updateTrack(track.id, { delay: Number(event.target.value) }, 'Change delay send')} /></label></div>
        <div className="fader-zone"><div className="fader-scale"><i>0</i><i>-6</i><i>-12</i><i>-24</i><i>-∞</i></div><input className="vertical-fader" aria-label={`${track.name} volume`} type="range" min="0" max="1.2" step="0.01" value={track.volume} onChange={(event) => updateTrack(track.id, { volume: Number(event.target.value) }, 'Change track volume')} /><output>{Math.round(track.volume * 100)}</output></div>
        <div className="channel-buttons"><button className={track.mute ? 'active mute' : ''} aria-pressed={track.mute} onClick={(event) => { event.stopPropagation(); updateTrack(track.id, { mute: !track.mute }, 'Toggle mute') }}>M</button><button className={track.solo ? 'active solo' : ''} aria-pressed={track.solo} onClick={(event) => { event.stopPropagation(); updateTrack(track.id, { solo: !track.solo }, 'Toggle solo') }}>S</button>{track.kind === 'audio' && <button className={track.armed ? 'active arm' : ''} aria-pressed={track.armed} onClick={(event) => { event.stopPropagation(); updateTrack(track.id, { armed: !track.armed }, 'Toggle arm') }}>R</button>}</div>
        <footer><Volume2 size={13} /><span>{track.mute ? 'SILENT' : `${Math.round(track.volume * 100)}%`}</span></footer>
      </article>)}
      <article className="channel-strip master-strip"><header><span className="channel-color" /><small>M</small><strong>MASTER</strong></header><div className="master-orbit"><Headphones size={24} /><span>STEREO OUT</span><small>SOFT LIMITER</small></div><div className="fader-zone"><div className="fader-scale"><i>0</i><i>-6</i><i>-12</i><i>-24</i><i>-∞</i></div><input className="vertical-fader" aria-label="Master volume" type="range" min="0" max="1.1" step="0.01" value={store.project.masterVolume} onChange={(event) => store.commit(touch({ ...store.project, masterVolume: Number(event.target.value) }), 'Change master volume')} /><output>{Math.round(store.project.masterVolume * 100)}</output></div><button className="reset-master" onClick={() => store.commit(touch({ ...store.project, masterVolume: .84 }), 'Reset master')}><RotateCcw size={13} /> RESET</button></article>
    </div></div>
  </div>
}
