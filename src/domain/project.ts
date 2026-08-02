import type { Clip, MidiClip, Project, Track, TrackKind } from './types'
import { getSongwritingLanguage } from '../songwriting/registry'

let sequence = 0
export const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(sequence++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const colors = ['#ffb454', '#ff6b86', '#58d6c7', '#9b8cff', '#63a9ff']

function makeMidiClip(name: string, color: string): MidiClip {
  return { id: makeId('clip'), type: 'midi', name, color, lengthBeats: 4, notes: [], volumeAutomation: Array(16).fill(1) }
}

function makeTrack(name: string, kind: TrackKind, index: number): { track: Track; clips: Clip[] } {
  const trackId = makeId('track')
  const track: Track = {
    id: trackId, name, kind, color: colors[index % colors.length], volume: 0.78, pan: 0,
    mute: false, solo: false, armed: false, delay: 0, waveform: index === 2 ? 'sawtooth' : 'triangle',
    attack: 0.01, release: kind === 'drum' ? 0.12 : 0.28, filterHz: kind === 'drum' ? 12000 : 4200,
    sessionSlots: [null, null, null, null],
  }
  const clips: Clip[] = []
  if (kind !== 'audio') {
    for (let scene = 0; scene < 4; scene++) {
      const clip = makeMidiClip(`${name} ${String.fromCharCode(65 + scene)}`, track.color)
      clips.push(clip)
      track.sessionSlots[scene] = clip.id
    }
  }
  return { track, clips }
}

export function createBlankProject(title = 'Untitled piece'): Project {
  const definitions: Array<[string, TrackKind]> = [['Pulse', 'drum'], ['Snap', 'drum'], ['Lowline', 'synth'], ['Prism', 'synth'], ['Audio', 'audio']]
  const tracks: Track[] = []
  const clips: Record<string, Clip> = {}
  definitions.forEach(([name, kind], index) => {
    const made = makeTrack(name, kind, index)
    tracks.push(made.track)
    made.clips.forEach((clip) => { clips[clip.id] = clip })
  })
  const now = new Date().toISOString()
  return {
    schemaVersion: 1, id: makeId('project'), title, bpm: 120, meter: [4, 4], masterVolume: 0.84,
    loop: { enabled: true, startBeat: 0, endBeat: 16 }, tracks, clips, arrangement: [], createdAt: now, modifiedAt: now,
  }
}

export function createDemoProject(): Project {
  const project = createBlankProject('First light')
  const patterns: number[][][] = [
    [[0, 36], [4, 36], [8, 36], [12, 36]],
    [[4, 38], [12, 38]],
    [[0, 36], [3, 36], [6, 43], [8, 36], [11, 46], [14, 43]],
    [[0, 60], [4, 63], [8, 67], [12, 70]],
  ]
  project.tracks.slice(0, 4).forEach((track, trackIndex) => {
    const clipId = track.sessionSlots[0]!
    const clip = project.clips[clipId] as MidiClip
    clip.notes = patterns[trackIndex].map(([step, pitch]) => ({ id: makeId('note'), step, pitch: trackIndex < 2 ? pitch : pitch - (trackIndex === 2 ? 12 : 0), velocity: trackIndex === 0 && step === 0 ? 1 : 0.78, durationSteps: trackIndex < 2 ? 1 : 3 }))
    project.arrangement.push({ id: makeId('block'), trackId: track.id, clipId, startBeat: 0, lengthBeats: 16, offsetBeats: 0 })
  })
  return project
}

export function duplicateClip(project: Project, clipId: string): { project: Project; clipId: string } {
  const original = project.clips[clipId]
  if (!original) return { project, clipId }
  const id = makeId('clip')
  const copy = structuredClone(original)
  copy.id = id
  copy.name = `${original.name} copy`
  return { project: touch({ ...project, clips: { ...project.clips, [id]: copy } }), clipId: id }
}

export const touch = (project: Project): Project => ({ ...project, modifiedAt: new Date().toISOString() })

function requireString(value: unknown, label: string, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} is invalid.`)
}

function requireNumber(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} is invalid.`)
}

export function validateProject(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('This file does not contain a Resonant project.')
  const p = value as Partial<Project>
  if (p.schemaVersion !== 1) throw new Error(`Unsupported project version: ${String(p.schemaVersion)}`)
  if (!Array.isArray(p.tracks) || !p.clips || typeof p.clips !== 'object' || !Array.isArray(p.arrangement)) throw new Error('The project is incomplete or damaged.')
  requireString(p.id, 'The project ID')
  requireString(p.title, 'The project title')
  requireNumber(p.bpm, 'The project tempo', 30, 300)
  requireNumber(p.masterVolume, 'The master volume', 0, 1.5)
  if (!Array.isArray(p.meter) || p.meter[0] !== 4 || p.meter[1] !== 4) throw new Error('Only the supported 4/4 meter can be loaded.')
  if (!p.loop || typeof p.loop.enabled !== 'boolean') throw new Error('The loop region is invalid.')
  requireNumber(p.loop.startBeat, 'The loop start', 0, 16384)
  requireNumber(p.loop.endBeat, 'The loop end', p.loop.startBeat + 0.25, 16384)
  if (p.tracks.length < 1 || p.tracks.length > 64) throw new Error('The project track count is invalid.')
  if (Object.keys(p.clips).length > 1024 || p.arrangement.length > 10000) throw new Error('The project exceeds Resonant safety limits.')
  const trackIds = new Set<string>()
  for (const track of p.tracks) {
    requireString(track.id, 'A track ID')
    requireString(track.name, 'A track name')
    if (trackIds.has(track.id)) throw new Error(`Duplicate track ID: ${track.id}`)
    trackIds.add(track.id)
    if (!['drum', 'synth', 'sampler', 'audio'].includes(track.kind) || !Array.isArray(track.sessionSlots) || track.sessionSlots.length > 32) throw new Error('A track is damaged.')
    requireNumber(track.volume, `${track.name} volume`, 0, 1.5)
    requireNumber(track.pan, `${track.name} pan`, -1, 1)
    requireNumber(track.delay, `${track.name} delay`, 0, 1)
    requireNumber(track.attack, `${track.name} attack`, 0.001, 10)
    requireNumber(track.release, `${track.name} release`, 0.005, 20)
    requireNumber(track.filterHz, `${track.name} filter`, 20, 24000)
    if (!['sine', 'triangle', 'sawtooth', 'square'].includes(track.waveform)) throw new Error(`${track.name} waveform is invalid.`)
    if (track.instrument !== undefined) {
      requireString(track.instrument.id, `${track.name} instrument ID`)
      requireString(track.instrument.name, `${track.name} instrument name`)
      if (!['soundfont', 'webaudiofont', 'sfz', 'sample'].includes(track.instrument.format)) throw new Error(`${track.name} instrument format is invalid.`)
      if (track.kind === 'audio') throw new Error(`${track.name} cannot use a playable instrument.`)
    }
    for (const clipId of track.sessionSlots) if (clipId) {
      const clip = p.clips[clipId]
      if (!clip) throw new Error(`Missing clip source: ${clipId}`)
      if ((clip.type === 'audio') !== (track.kind === 'audio')) throw new Error(`${track.name} cannot play ${clip.type} clip ${clip.name}.`)
    }
  }
  for (const [clipKey, clip] of Object.entries(p.clips)) {
    requireString(clip.id, 'A clip ID')
    requireString(clip.name, 'A clip name')
    if (clip.id !== clipKey) throw new Error(`Clip key does not match its ID: ${clipKey}`)
    requireNumber(clip.lengthBeats, `${clip.name} length`, 0.25, 1024)
    if (!Array.isArray(clip.volumeAutomation) || clip.volumeAutomation.length < 1 || clip.volumeAutomation.length > 4096) throw new Error(`${clip.name} automation is invalid.`)
    clip.volumeAutomation.forEach((value) => requireNumber(value, `${clip.name} automation`, 0, 2))
    if (clip.type === 'midi') {
      if (!Array.isArray(clip.notes) || clip.notes.length > 10000) throw new Error(`${clip.name} notes are invalid.`)
      const maxStep = Math.ceil(clip.lengthBeats * 4) - 1
      const noteIds = new Set<string>()
      for (const note of clip.notes) {
        requireString(note.id, 'A note ID')
        if (noteIds.has(note.id)) throw new Error(`Duplicate note ID: ${note.id}`)
        noteIds.add(note.id)
        if (!Number.isInteger(note.step) || note.step < 0 || note.step > maxStep) throw new Error(`${clip.name} contains an invalid note step.`)
        if (!Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127) throw new Error(`${clip.name} contains an invalid pitch.`)
        requireNumber(note.velocity, `${clip.name} note velocity`, 0, 1)
        if (!Number.isInteger(note.durationSteps) || note.durationSteps < 1 || note.durationSteps > 256) throw new Error(`${clip.name} contains an invalid note duration.`)
      }
    } else if (clip.type === 'audio') {
      requireNumber(clip.sampleRate, `${clip.name} sample rate`, 8000, 192000)
      if (clip.channels !== 1 && clip.channels !== 2) throw new Error(`${clip.name} channel count is invalid.`)
      if (!Number.isInteger(clip.frames) || clip.frames < 1 || clip.frames > clip.sampleRate * 60 * 60) throw new Error(`${clip.name} frame count is invalid.`)
      const embedded = typeof clip.pcmBase64 === 'string' && clip.pcmBase64.length > 0
      const external = clip.asset !== undefined
      if (embedded === external) throw new Error(`${clip.name} must contain exactly one embedded or shared audio source.`)
      if (embedded) {
        const expectedPcmBytes = clip.frames * clip.channels * 4
        const expectedBase64Length = Math.ceil(expectedPcmBytes / 3) * 4
        if (clip.pcmBase64!.length !== expectedBase64Length || clip.pcmBase64!.length > 250_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clip.pcmBase64!)) throw new Error(`${clip.name} audio data is invalid.`)
      } else {
        if (!clip.asset || !/^[a-f0-9]{64}$/i.test(clip.asset.id) || clip.asset.sha256 !== clip.asset.id || clip.asset.format !== 'wav-pcm16' || !Number.isInteger(clip.asset.bytes) || clip.asset.bytes < 44 || clip.asset.bytes > 250_000_000) throw new Error(`${clip.name} shared audio reference is invalid.`)
      }
      if (clip.waveformPeaks !== undefined) {
        if (!Array.isArray(clip.waveformPeaks) || clip.waveformPeaks.length < 16 || clip.waveformPeaks.length > 256) throw new Error(`${clip.name} waveform summary is invalid.`)
        clip.waveformPeaks.forEach((value) => requireNumber(value, `${clip.name} waveform peak`, 0, 1))
      }
      requireNumber(clip.trimStart, `${clip.name} trim start`, 0, clip.frames / clip.sampleRate)
      requireNumber(clip.trimEnd, `${clip.name} trim end`, 0, clip.frames / clip.sampleRate)
      if (clip.trimStart + clip.trimEnd >= clip.frames / clip.sampleRate) throw new Error(`${clip.name} trim removes all audio.`)
      requireNumber(clip.gain, `${clip.name} gain`, 0, 4)
    } else throw new Error('A clip has an unsupported type.')
  }
  for (const block of p.arrangement) {
    if (!trackIds.has(block.trackId) || !p.clips[block.clipId]) throw new Error('The arrangement refers to missing material.')
    const track = p.tracks.find((candidate) => candidate.id === block.trackId)!
    const clip = p.clips[block.clipId]
    if ((clip.type === 'audio') !== (track.kind === 'audio')) throw new Error(`${track.name} cannot play ${clip.type} clip ${clip.name}.`)
    requireString(block.id, 'An arrangement block ID')
    requireNumber(block.startBeat, 'An arrangement start', 0, 16384)
    requireNumber(block.lengthBeats, 'An arrangement length', 0.25, 16384)
    requireNumber(block.offsetBeats, 'An arrangement offset', 0, p.clips[block.clipId].lengthBeats)
  }
  if (p.songwriting !== undefined) {
    const draft = p.songwriting
    if (!draft || typeof draft !== 'object') throw new Error('The songwriting draft is invalid.')
    getSongwritingLanguage(draft.language)
    for (const [key, max] of Object.entries({ title: 200, idea: 4000, hook: 500, mood: 300, genre: 300, audience: 1000, imagery: 3000, stylePrompt: 2000, lyrics: 20000 })) {
      const value = draft[key as keyof typeof draft]
      if (typeof value !== 'string' || value.length > max) throw new Error(`The songwriting ${key} is invalid.`)
    }
    if (!['first-person', 'second-person', 'third-person', 'collective'].includes(draft.pointOfView)) throw new Error('The songwriting point of view is invalid.')
    if (!['past', 'present', 'future', 'mixed'].includes(draft.tense)) throw new Error('The songwriting tense is invalid.')
  }
  requireString(p.createdAt, 'The project creation date')
  requireString(p.modifiedAt, 'The project modification date')
  return structuredClone(p as Project)
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2)
}

export function parseProject(text: string): Project {
  try { return validateProject(JSON.parse(text)) } catch (error) {
    if (error instanceof SyntaxError) throw new Error('This project file is not valid JSON.')
    throw error
  }
}
