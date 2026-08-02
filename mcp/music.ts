import { makeId } from '../src/domain/project'
import { floatsToBase64, summarizeWaveform } from '../src/domain/pcm'
import { encodeWav, renderProject } from '../src/domain/render'
import { renderSoundFontNote } from '../src/audio/instrumentPlayback'
import { beatToSample, stepToBeat } from '../src/domain/time'
import type { ArrangementBlock, AudioClip, Clip, InstrumentRef, MidiClip, MidiNote, Project, Track, Waveform } from '../src/domain/types'

export const DRUM_MAP = { kick: 36, snare: 38, closedHat: 42, pedalHat: 43, openHat: 46 } as const

export interface NoteInput {
  step: number
  pitch: number
  velocity?: number
  durationSteps?: number
}

export interface ArrangementInput {
  track: string
  clip: string
  startBeat: number
  lengthBeats: number
  offsetBeats?: number
}

export interface TrackMixPatch {
  volume?: number
  pan?: number
  delay?: number
  mute?: boolean
  solo?: boolean
  waveform?: Waveform
  attack?: number
  release?: number
  filterHz?: number
}

export function resolveTrack(project: Project, reference: string): Track {
  const exact = project.tracks.find((track) => track.id === reference)
  if (exact) return exact
  const matches = project.tracks.filter((track) => track.name.toLowerCase() === reference.toLowerCase())
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) throw new Error(`Track name is ambiguous: ${reference}. Use a track ID.`)
  throw new Error(`Track not found: ${reference}`)
}

export function resolveClip(project: Project, reference: string): Clip {
  if (project.clips[reference]) return project.clips[reference]
  const matches = Object.values(project.clips).filter((clip) => clip.name.toLowerCase() === reference.toLowerCase())
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) throw new Error(`Clip name is ambiguous: ${reference}. Use a clip ID.`)
  throw new Error(`Clip not found: ${reference}`)
}

function clipSummary(clip: Clip) {
  if (clip.type === 'midi') return {
    id: clip.id, name: clip.name, type: clip.type, lengthBeats: clip.lengthBeats,
    notes: clip.notes.slice(0, 512).map(({ id, step, pitch, velocity, durationSteps }) => ({ id, step, pitch, velocity, durationSteps })),
    noteCount: clip.notes.length, notesTruncated: clip.notes.length > 512, volumeAutomation: clip.volumeAutomation,
  }
  return {
    id: clip.id, name: clip.name, type: clip.type, lengthBeats: clip.lengthBeats, sampleRate: clip.sampleRate,
    channels: clip.channels, frames: clip.frames, durationSeconds: clip.frames / clip.sampleRate,
    trimStart: clip.trimStart, trimEnd: clip.trimEnd, gain: clip.gain, volumeAutomation: clip.volumeAutomation, asset: clip.asset ?? null,
  }
}

export function inspectProject(project: Project, path: string, revision: string) {
  const endBeat = project.arrangement.reduce((end, block) => Math.max(end, block.startBeat + block.lengthBeats), 0)
  return {
    path, revision, schemaVersion: project.schemaVersion, id: project.id, title: project.title, bpm: project.bpm,
    meter: project.meter, masterVolume: project.masterVolume, loop: project.loop, durationBeats: endBeat,
    tracks: project.tracks.map((track) => ({
      id: track.id, name: track.name, kind: track.kind, color: track.color, volume: track.volume, pan: track.pan,
      mute: track.mute, solo: track.solo, delay: track.delay, waveform: track.waveform, attack: track.attack,
      release: track.release, filterHz: track.filterHz,
      instrument: track.instrument ?? null,
      sessionSlots: track.sessionSlots.map((clipId, slot) => ({ slot, clipId, clipName: clipId ? project.clips[clipId]?.name ?? null : null })),
    })),
    clips: Object.values(project.clips).map(clipSummary),
    arrangement: project.arrangement.slice(0, 1000).map((block) => ({
      ...block, trackName: project.tracks.find((track) => track.id === block.trackId)?.name,
      clipName: project.clips[block.clipId]?.name,
    })),
    arrangementTruncated: project.arrangement.length > 1000,
    songwriting: project.songwriting ?? null,
    createdAt: project.createdAt, modifiedAt: project.modifiedAt,
  }
}

export function setProjectSettings(project: Project, settings: {
  title?: string
  bpm?: number
  masterVolume?: number
  loopEnabled?: boolean
  loopStartBeat?: number
  loopEndBeat?: number
}) {
  const loop = {
    enabled: settings.loopEnabled ?? project.loop.enabled,
    startBeat: settings.loopStartBeat ?? project.loop.startBeat,
    endBeat: settings.loopEndBeat ?? project.loop.endBeat,
  }
  if (loop.endBeat <= loop.startBeat) throw new Error('Loop end must be after loop start.')
  return { ...project, title: settings.title ?? project.title, bpm: settings.bpm ?? project.bpm, masterVolume: settings.masterVolume ?? project.masterVolume, loop }
}

export function setClipNotes(project: Project, clipReference: string, notes: NoteInput[], mode: 'replace' | 'merge' = 'replace') {
  const clip = resolveClip(project, clipReference)
  if (clip.type !== 'midi') throw new Error('Notes can only be written to a MIDI clip.')
  const maxStep = Math.ceil(clip.lengthBeats * 4) - 1
  const made: MidiNote[] = notes.map((note) => {
    if (!Number.isInteger(note.step) || note.step < 0 || note.step > maxStep) throw new Error(`Step ${note.step} is outside this ${maxStep + 1}-step clip.`)
    return { id: makeId('note'), step: note.step, pitch: note.pitch, velocity: note.velocity ?? 0.8, durationSteps: note.durationSteps ?? 1 }
  })
  let nextNotes = made
  if (mode === 'merge') {
    const keyed = new Map(clip.notes.map((note) => [`${note.step}:${note.pitch}`, note]))
    made.forEach((note) => keyed.set(`${note.step}:${note.pitch}`, note))
    nextNotes = [...keyed.values()]
  }
  nextNotes.sort((a, b) => a.step - b.step || a.pitch - b.pitch)
  const updated: MidiClip = { ...clip, notes: nextNotes }
  return { project: { ...project, clips: { ...project.clips, [clip.id]: updated } }, clip: updated }
}

export function duplicateClip(project: Project, clipReference: string, options: { name?: string; track?: string; slot?: number }) {
  const source = resolveClip(project, clipReference)
  const id = makeId('clip')
  const copy = structuredClone(source)
  copy.id = id
  copy.name = options.name ?? `${source.name} variation`
  let tracks = project.tracks
  if (options.track !== undefined || options.slot !== undefined) {
    if (options.track === undefined || options.slot === undefined) throw new Error('Both track and slot are required when assigning the new clip.')
    const target = resolveTrack(project, options.track)
    if ((copy.type === 'audio') !== (target.kind === 'audio')) throw new Error('Audio clips require an audio track; MIDI clips require a drum or synth track.')
    const slots = [...target.sessionSlots]
    while (slots.length <= options.slot) slots.push(null)
    slots[options.slot] = id
    tracks = project.tracks.map((track) => track.id === target.id ? { ...track, sessionSlots: slots } : track)
  }
  return { project: { ...project, tracks, clips: { ...project.clips, [id]: copy } }, clip: copy }
}

function requireCompatible(track: Track, clip: Clip) {
  if (clip.type === 'audio' && track.kind !== 'audio') throw new Error(`Audio clip ${clip.name} requires an audio track.`)
  if (clip.type === 'midi' && track.kind === 'audio') throw new Error(`MIDI clip ${clip.name} cannot play on an audio track.`)
}

export function setArrangement(project: Project, inputs: ArrangementInput[], mode: 'replace' | 'append' = 'replace') {
  const blocks: ArrangementBlock[] = inputs.map((input) => {
    const track = resolveTrack(project, input.track)
    const clip = resolveClip(project, input.clip)
    requireCompatible(track, clip)
    return { id: makeId('block'), trackId: track.id, clipId: clip.id, startBeat: input.startBeat, lengthBeats: input.lengthBeats, offsetBeats: input.offsetBeats ?? 0 }
  })
  return { ...project, arrangement: mode === 'append' ? [...project.arrangement, ...blocks] : blocks }
}

export function setTrackMix(project: Project, trackReference: string, patch: TrackMixPatch) {
  const selected = resolveTrack(project, trackReference)
  const track = { ...selected, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) } as Track
  return { project: { ...project, tracks: project.tracks.map((candidate) => candidate.id === track.id ? track : candidate) }, track }
}

export function setClipAutomation(project: Project, clipReference: string, values: number[]) {
  const clip = resolveClip(project, clipReference)
  const updated = { ...clip, volumeAutomation: [...values] } as Clip
  return { project: { ...project, clips: { ...project.clips, [clip.id]: updated } }, clip: updated }
}

function readTag(view: DataView, offset: number, length: number) {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join('')
}

export function decodeWav(bytes: Uint8Array) {
  if (bytes.byteLength < 44) throw new Error('The WAV file is too small.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (readTag(view, 0, 4) !== 'RIFF' || readTag(view, 8, 4) !== 'WAVE') throw new Error('Only RIFF/WAVE audio can be imported.')
  let format = 0, channels = 0, sampleRate = 0, bits = 0, blockAlign = 0, dataOffset = -1, dataBytes = 0
  let offset = 12
  while (offset + 8 <= view.byteLength) {
    const tag = readTag(view, offset, 4)
    const size = view.getUint32(offset + 4, true)
    const payload = offset + 8
    if (payload + size > view.byteLength) throw new Error('The WAV file has a damaged chunk.')
    if (tag === 'fmt ') {
      if (size < 16) throw new Error('The WAV format chunk is incomplete.')
      format = view.getUint16(payload, true); channels = view.getUint16(payload + 2, true); sampleRate = view.getUint32(payload + 4, true)
      blockAlign = view.getUint16(payload + 12, true); bits = view.getUint16(payload + 14, true)
    } else if (tag === 'data') { dataOffset = payload; dataBytes = size }
    offset = payload + size + (size % 2)
  }
  if (![1, 3].includes(format) || ![1, 2].includes(channels) || sampleRate < 8000 || sampleRate > 192000 || !blockAlign || dataOffset < 0) throw new Error('Unsupported WAV format. Use mono/stereo PCM or 32-bit float WAV.')
  if ((format === 1 && ![8, 16, 24, 32].includes(bits)) || (format === 3 && bits !== 32)) throw new Error('Unsupported WAV bit depth.')
  const frames = Math.floor(dataBytes / blockAlign)
  if (frames < 1 || frames > sampleRate * 60 * 60) throw new Error('WAV duration is outside the supported range.')
  const output = Array.from({ length: channels }, () => new Float32Array(frames))
  const bytesPerSample = bits / 8
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels; channel++) {
    const sampleOffset = dataOffset + frame * blockAlign + channel * bytesPerSample
    let sample: number
    if (format === 3) sample = view.getFloat32(sampleOffset, true)
    else if (bits === 8) sample = (view.getUint8(sampleOffset) - 128) / 128
    else if (bits === 16) sample = view.getInt16(sampleOffset, true) / 32768
    else if (bits === 24) {
      let value = view.getUint8(sampleOffset) | (view.getUint8(sampleOffset + 1) << 8) | (view.getUint8(sampleOffset + 2) << 16)
      if (value & 0x800000) value |= ~0xffffff
      sample = value / 8388608
    } else sample = view.getInt32(sampleOffset, true) / 2147483648
    output[channel][frame] = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0
  }
  return { channels: output as [Float32Array] | [Float32Array, Float32Array], sampleRate, frames }
}

export function importWav(project: Project, bytes: Uint8Array, options: { name: string; track?: string; slot: number; asset?: AudioClip['asset'] }) {
  if (bytes.byteLength > 100_000_000) throw new Error('WAV import is limited to 100 MB.')
  const decoded = decodeWav(bytes)
  const pcmBytes = decoded.frames * decoded.channels.length * 4
  const encodedLength = Math.ceil(pcmBytes / 3) * 4
  const existingAudioLength = Object.values(project.clips).reduce((total, clip) => total + (clip.type === 'audio' ? clip.pcmBase64?.length ?? 0 : 0), 0)
  if (!options.asset && (pcmBytes > 100_000_000 || existingAudioLength + encodedLength > 240_000_000)) throw new Error('The decoded WAV is too large to embed safely. Import a shorter file.')
  const track = options.track ? resolveTrack(project, options.track) : project.tracks.find((candidate) => candidate.kind === 'audio')
  if (!track || track.kind !== 'audio') throw new Error('Choose an audio track for WAV import.')
  const lengthBeats = decoded.frames / decoded.sampleRate * project.bpm / 60
  if (lengthBeats > 1024) throw new Error('This WAV is too long for the current project format.')
  const clip: AudioClip = {
    id: makeId('clip'), type: 'audio', name: options.name, color: track.color, lengthBeats: Math.max(0.25, lengthBeats),
    sampleRate: decoded.sampleRate, channels: decoded.channels.length as 1 | 2, frames: decoded.frames,
    ...(options.asset ? { asset: options.asset } : { pcmBase64: floatsToBase64(decoded.channels) }), waveformPeaks: summarizeWaveform(decoded.channels), trimStart: 0, trimEnd: 0, gain: 1, volumeAutomation: Array(16).fill(1),
  }
  const slots = [...track.sessionSlots]
  while (slots.length <= options.slot) slots.push(null)
  slots[options.slot] = clip.id
  const tracks = project.tracks.map((candidate) => candidate.id === track.id ? { ...candidate, sessionSlots: slots } : candidate)
  return { project: { ...project, tracks, clips: { ...project.clips, [clip.id]: clip } }, clip }
}

function db(value: number) {
  return value <= 1e-12 ? -120 : 20 * Math.log10(value)
}

function analyzeRendered(rendered: ReturnType<typeof renderProject>) {
  let peakL = 0, peakR = 0, squareL = 0, squareR = 0, sumL = 0, sumR = 0, cross = 0, clippedSamples = 0
  for (let index = 0; index < rendered.left.length; index++) {
    const left = rendered.left[index], right = rendered.right[index]
    peakL = Math.max(peakL, Math.abs(left)); peakR = Math.max(peakR, Math.abs(right))
    squareL += left * left; squareR += right * right; sumL += left; sumR += right; cross += left * right
    if (Math.abs(left) >= 0.999 || Math.abs(right) >= 0.999) clippedSamples++
  }
  const frames = rendered.left.length
  const rmsL = Math.sqrt(squareL / frames), rmsR = Math.sqrt(squareR / frames), rms = Math.sqrt((squareL + squareR) / (frames * 2))
  const peak = Math.max(peakL, peakR)
  const correlation = squareL && squareR ? cross / Math.sqrt(squareL * squareR) : 0
  const balanceDb = db(rmsL) - db(rmsR)
  const warnings: string[] = []
  if (peak === 0) warnings.push('The rendered arrangement is silent.')
  if (db(peak) > -0.3) warnings.push('Peak level is within 0.3 dB of full scale; reduce track or master gain for more headroom.')
  if (db(rms) < -30 && peak > 0) warnings.push('Average level is very quiet relative to full scale.')
  if (Math.abs(balanceDb) > 3) warnings.push('Left/right RMS balance differs by more than 3 dB.')
  return {
    sampleRate: rendered.sampleRate, durationBeats: rendered.durationBeats, durationSeconds: frames / rendered.sampleRate, frames,
    peakDbfs: Number(db(peak).toFixed(2)), peakLeftDbfs: Number(db(peakL).toFixed(2)), peakRightDbfs: Number(db(peakR).toFixed(2)),
    rmsDbfs: Number(db(rms).toFixed(2)), rmsLeftDbfs: Number(db(rmsL).toFixed(2)), rmsRightDbfs: Number(db(rmsR).toFixed(2)),
    crestFactorDb: Number((db(peak) - db(rms)).toFixed(2)), stereoBalanceDb: Number(balanceDb.toFixed(2)),
    stereoCorrelation: Number(correlation.toFixed(3)), dcOffsetLeft: Number((sumL / frames).toFixed(6)), dcOffsetRight: Number((sumR / frames).toFixed(6)),
    clippedSamples, warnings,
  }
}

export function analyzeMix(project: Project, durationBeats?: number, sampleRate = 44100) {
  return analyzeRendered(renderProject(project, durationBeats, sampleRate))
}

export function renderWav(project: Project, durationBeats?: number) {
  return encodeWav(renderProject(project, durationBeats, 44100))
}

type SoundFontLoader = (id: string) => Promise<{ summary: InstrumentRef; data?: ArrayBuffer }>

export async function renderWithInstalledInstruments(project: Project, loader: SoundFontLoader, durationBeats?: number, sampleRate = 44100) {
  if (!project.tracks.some((track) => track.instrument)) return renderProject(project, durationBeats, sampleRate)
  const rendered = renderProject(project, durationBeats, sampleRate, { skipInstrumentTracks: true, finalize: false })
  const anySolo = project.tracks.some((track) => track.solo)
  const loaded = new Map<string, Awaited<ReturnType<SoundFontLoader>>>()
  const notes = new Map<string, Awaited<ReturnType<typeof renderSoundFontNote>>>()
  for (const block of project.arrangement) {
    const track = project.tracks.find((candidate) => candidate.id === block.trackId), clip = project.clips[block.clipId]
    if (!track?.instrument || clip?.type !== 'midi' || track.mute || (anySolo && !track.solo)) continue
    let installed = loaded.get(track.instrument.id)
    if (!installed) { installed = await loader(track.instrument.id); loaded.set(track.instrument.id, installed) }
    if (track.instrument.format !== 'soundfont' || !installed.data) throw new Error(`MCP rendering currently requires a SoundFont instrument; ${track.instrument.name} uses ${track.instrument.format}. Render this project in the desktop app or choose an installed SF2/SF3/DLS preset.`)
    const loops = Math.ceil((block.lengthBeats + block.offsetBeats) / clip.lengthBeats)
    for (let loop = 0; loop < loops; loop++) for (const event of clip.notes) {
      const relativeBeat = loop * clip.lengthBeats + stepToBeat(event.step) - block.offsetBeats
      if (relativeBeat < 0 || relativeBeat >= block.lengthBeats) continue
      const duration = event.durationSteps * 0.25 * 60 / project.bpm
      const key = `${track.instrument.id}:${event.pitch}:${event.durationSteps}:${project.bpm}:${sampleRate}`
      let note = notes.get(key)
      if (!note) { note = await renderSoundFontNote(installed.data, track.instrument, event.pitch, duration, sampleRate); notes.set(key, note) }
      const start = beatToSample(block.startBeat + relativeBeat, project.bpm, sampleRate)
      const gain = event.velocity * (clip.volumeAutomation[event.step] ?? 1) * track.volume
      const panL = Math.cos((track.pan + 1) * Math.PI / 4), panR = Math.sin((track.pan + 1) * Math.PI / 4)
      for (let frame = 0; frame < note.left.length && start + frame < rendered.left.length; frame++) {
        const left = note.left[frame] * gain * panL, right = note.right[frame] * gain * panR
        rendered.left[start + frame] += left; rendered.right[start + frame] += right
        if (track.delay > 0) {
          const delayed = start + frame + Math.floor(sampleRate * 60 / project.bpm * 0.75)
          if (delayed < rendered.left.length) { rendered.left[delayed] += left * track.delay * 0.38; rendered.right[delayed] += right * track.delay * 0.38 }
        }
      }
    }
  }
  for (let frame = 0; frame < rendered.left.length; frame++) {
    rendered.left[frame] = Math.tanh(rendered.left[frame] * project.masterVolume)
    rendered.right[frame] = Math.tanh(rendered.right[frame] * project.masterVolume)
  }
  return rendered
}

export async function analyzeMixWithInstalledInstruments(project: Project, loader: SoundFontLoader, durationBeats?: number, sampleRate = 44100) {
  return analyzeRendered(await renderWithInstalledInstruments(project, loader, durationBeats, sampleRate))
}

export async function renderWavWithInstalledInstruments(project: Project, loader: SoundFontLoader, durationBeats?: number) {
  return encodeWav(await renderWithInstalledInstruments(project, loader, durationBeats, 44100))
}
