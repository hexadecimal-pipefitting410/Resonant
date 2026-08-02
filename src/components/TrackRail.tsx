import { AudioLines, Drum, Mic2, Music2 } from 'lucide-react'
import { useAppStore } from '../store/AppStore'

export function TrackRail({ activeClips }: { activeClips: Record<string, string | null> }) {
  const store = useAppStore()
  return <aside className="track-rail" aria-label="Tracks">
    <div className="panel-heading"><span>TRACKS</span><small>{store.project.tracks.length}</small></div>
    <div className="track-list">{store.project.tracks.map((track, index) => {
      const Icon = track.kind === 'drum' ? Drum : track.kind === 'audio' ? Mic2 : Music2
      const clip = activeClips[track.id] ? store.project.clips[activeClips[track.id]!] : undefined
      return <button key={track.id} className={`track-row ${store.selectedTrackId === track.id ? 'selected' : ''}`} onClick={() => store.selectTrack(track.id, clip?.id ?? track.sessionSlots.find(Boolean) ?? null)}>
        <span className="track-index">{String(index + 1).padStart(2, '0')}</span><span className="track-color" style={{ background: track.color }} /><Icon size={16} />
        <span className="track-copy"><strong>{track.name}</strong><small>{clip ? clip.name : track.kind === 'audio' ? 'No take' : 'No clip launched'}</small></span>
        <span className="track-states">{track.armed && <i className="armed" title="Armed" />}{track.mute && <b>M</b>}{track.solo && <b>S</b>}</span>
      </button>
    })}</div>
    <div className="rail-foot"><AudioLines size={14} /><span>MASTER</span><strong>{Math.round(store.project.masterVolume * 100)}</strong></div>
  </aside>
}
