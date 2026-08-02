import { useState } from 'react'
import { Rows3, ChevronLeft, ChevronRight, Copy, Minus, Plus, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { makeId, touch } from '../domain/project'
import { useAppStore } from '../store/AppStore'

export function ArrangementView({ beat, notify, captureSession }: { beat: number; notify(message: string, tone?: 'info' | 'error' | 'success'): void; captureSession(): void }) {
  const store = useAppStore()
  const [pixelsPerBeat, setPixelsPerBeat] = useState(34)
  const arrangementEnd = store.project.arrangement.reduce((end, block) => Math.max(end, block.startBeat + block.lengthBeats), 0)
  const bars = Math.min(4096, Math.max(32, Math.ceil((Math.max(arrangementEnd, store.project.loop.endBeat, beat) + 4) / 4))), width = bars * 4 * pixelsPerBeat
  const selected = store.project.arrangement.find((block) => block.id === store.selectedBlockId)

  const editSelected = (deltaStart = 0, deltaLength = 0) => {
    if (!selected) return
    const arrangement = store.project.arrangement.map((block) => block.id === selected.id ? { ...block, startBeat: Math.max(0, Math.min(16384, block.startBeat + deltaStart)), lengthBeats: Math.max(1, Math.min(16384, block.lengthBeats + deltaLength)) } : block)
    store.commit(touch({ ...store.project, arrangement }), deltaStart ? 'Move arrangement block' : 'Resize arrangement block')
  }
  const removeSelected = () => {
    if (!selected) return
    store.commit(touch({ ...store.project, arrangement: store.project.arrangement.filter((block) => block.id !== selected.id) }), 'Remove arrangement block'); store.selectBlock(null)
  }
  const duplicateSelected = () => {
    if (!selected) return
    if (selected.startBeat + selected.lengthBeats > 16384) { notify('This block cannot be duplicated beyond the project timeline limit.', 'error'); return }
    const duplicate = { ...selected, id: makeId('block'), startBeat: selected.startBeat + selected.lengthBeats }
    store.commit(touch({ ...store.project, arrangement: [...store.project.arrangement, duplicate] }), 'Duplicate arrangement block'); store.selectBlock(duplicate.id)
  }

  return <div className="arrange-view">
    <div className="section-heading arrange-heading"><div><span className="eyebrow">LINEAR COMPOSITION</span><h2>Arrangement</h2></div><div className="arrange-tools">
      <button onClick={captureSession}><Rows3 size={14} /> CAPTURE SESSION</button><span className="tool-divider" />
      <label className="loop-range"><span>LOOP</span><input aria-label="Loop start beat" type="number" min="0" max={store.project.loop.endBeat - 1} value={store.project.loop.startBeat} onChange={(event) => {
        const startBeat = Math.max(0, Math.min(store.project.loop.endBeat - 1, Number(event.target.value))); store.commit(touch({ ...store.project, loop: { ...store.project.loop, startBeat } }), 'Change loop start')
      }} /><i>→</i><input aria-label="Loop end beat" type="number" min={store.project.loop.startBeat + 1} max="16384" value={store.project.loop.endBeat} onChange={(event) => {
        const endBeat = Math.max(store.project.loop.startBeat + 1, Math.min(16384, Number(event.target.value))); store.commit(touch({ ...store.project, loop: { ...store.project.loop, endBeat } }), 'Change loop end')
      }} /></label><span className="tool-divider" />
      <button disabled={!selected} title="Move one beat left" onClick={() => editSelected(-1, 0)}><ChevronLeft size={14} /></button><button disabled={!selected} title="Move one beat right" onClick={() => editSelected(1, 0)}><ChevronRight size={14} /></button>
      <button disabled={!selected} title="Shorten one beat" onClick={() => editSelected(0, -1)}><Minus size={14} /></button><button disabled={!selected} title="Lengthen one beat" onClick={() => editSelected(0, 1)}><Plus size={14} /></button>
      <button disabled={!selected} title="Duplicate block" onClick={duplicateSelected}><Copy size={14} /></button><button disabled={!selected} title="Delete block" onClick={removeSelected}><Trash2 size={14} /></button><span className="tool-divider" />
      <button title="Zoom out" onClick={() => setPixelsPerBeat((value) => Math.max(18, value - 4))}><ZoomOut size={14} /></button><b>{Math.round(pixelsPerBeat / 34 * 100)}%</b><button title="Zoom in" onClick={() => setPixelsPerBeat((value) => Math.min(60, value + 4))}><ZoomIn size={14} /></button>
    </div></div>
    <div className="timeline-scroll">
      <div className="timeline" style={{ width: width + 112 }}>
        <div className="ruler-label">BARS</div><div className="ruler" style={{ width }}>{Array.from({ length: bars }, (_, index) => <span key={index} style={{ width: pixelsPerBeat * 4 }}>{index + 1}<i /></span>)}</div>
        {store.project.tracks.map((track, trackIndex) => <div className="arrangement-row" key={track.id}>
          <button className="arrangement-track-label" onClick={() => store.selectTrack(track.id, track.sessionSlots.find(Boolean) ?? null)}><span style={{ background: track.color }} />{String(trackIndex + 1).padStart(2, '0')}<strong>{track.name}</strong></button>
          <div className="arrangement-lane" style={{ width, backgroundSize: `${pixelsPerBeat}px 100%, ${pixelsPerBeat * 4}px 100%` }} onClick={(event) => {
            if (event.target !== event.currentTarget) return
            const clipId = store.selectedTrackId === track.id ? store.selectedClipId : track.sessionSlots.find(Boolean)
            if (!clipId || !store.project.clips[clipId]) { notify(`Choose a ${track.name} clip in Flow first.`, 'error'); return }
            const rect = event.currentTarget.getBoundingClientRect(), startBeat = Math.floor((event.clientX - rect.left) / pixelsPerBeat)
            const block = { id: makeId('block'), trackId: track.id, clipId, startBeat, lengthBeats: 4, offsetBeats: 0 }
            store.commit(touch({ ...store.project, arrangement: [...store.project.arrangement, block] }), 'Place arrangement block'); store.selectBlock(block.id)
          }}>
            {store.project.arrangement.filter((block) => block.trackId === track.id).map((block) => {
              const clip = store.project.clips[block.clipId]
              return <button key={block.id} className={`arrangement-block ${store.selectedBlockId === block.id ? 'selected' : ''}`} style={{ left: block.startBeat * pixelsPerBeat, width: Math.max(28, block.lengthBeats * pixelsPerBeat), '--clip-color': clip?.color ?? track.color } as React.CSSProperties} onClick={(event) => { event.stopPropagation(); store.selectTrack(track.id, block.clipId); store.selectBlock(block.id) }}>
                <span className="block-title">{clip?.name ?? 'Missing clip'}</span><span className="block-loop">{Array.from({ length: Math.max(1, Math.ceil(block.lengthBeats / (clip?.lengthBeats ?? 4))) }, (_, index) => <i key={index} />)}</span><small>{block.lengthBeats} beats</small>
              </button>
            })}
          </div>
        </div>)}
        <div className="arrangement-playhead" style={{ left: 112 + beat * pixelsPerBeat }}><span /></div>
      </div>
      {!store.project.arrangement.length && <div className="arrangement-empty"><Rows3 size={24} /><strong>Your song has room to breathe.</strong><span>Capture a live combination, or click any track lane to place the selected clip.</span><button onClick={captureSession}>CAPTURE ACTIVE CLIPS</button></div>}
    </div>
  </div>
}
