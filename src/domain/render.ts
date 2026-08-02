import type { AudioClip, MidiClip, Project, Track } from './types'
import { base64ToFloats } from './pcm'
import { beatToSample, stepToBeat } from './time'

export interface RenderResult { left: Float32Array; right: Float32Array; sampleRate: number; durationBeats: number }

function midiHz(note: number) { return 440 * 2 ** ((note - 69) / 12) }
function seededNoise(seed: number) { let x = seed | 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) / 0xffffffff) * 2 - 1 } }

function addMidi(outL: Float32Array, outR: Float32Array, clip: MidiClip, track: Track, startBeat: number, blockLength: number, offsetBeats: number, bpm: number, rate: number) {
  const clipLoops = Math.ceil((blockLength + offsetBeats) / clip.lengthBeats)
  const noise = seededNoise(17 + track.name.length)
  for (let loop = 0; loop < clipLoops; loop++) for (const note of clip.notes) {
    const relativeBeat = loop * clip.lengthBeats + stepToBeat(note.step) - offsetBeats
    if (relativeBeat < 0 || relativeBeat >= blockLength) continue
    const beat = startBeat + relativeBeat
    const start = beatToSample(beat, bpm, rate)
    const duration = Math.max(0.04, note.durationSteps * 0.25 * 60 / bpm + track.release)
    const frames = Math.floor(duration * rate)
    const freq = midiHz(note.pitch)
    const auto = clip.volumeAutomation[note.step] ?? 1
    for (let i = 0; i < frames && start + i < outL.length; i++) {
      const t = i / rate
      const attack = Math.min(1, t / Math.max(0.002, track.attack))
      const release = Math.min(1, (duration - t) / Math.max(0.01, track.release))
      let wave: number
      if (track.kind === 'drum') {
        if (note.pitch <= 36) wave = Math.sin(2 * Math.PI * (freq * 1.35 * Math.exp(-t * 22) + 38) * t) * Math.exp(-t * 18)
        else wave = noise() * Math.exp(-t * (note.pitch < 40 ? 24 : 36))
      } else {
        const phase = freq * t
        wave = track.waveform === 'sine' ? Math.sin(2 * Math.PI * phase) : track.waveform === 'square' ? (Math.sin(2 * Math.PI * phase) >= 0 ? 1 : -1) : track.waveform === 'sawtooth' ? 2 * (phase - Math.floor(phase + 0.5)) : 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1
        wave *= 0.42
      }
      const value = wave * attack * release * note.velocity * track.volume * auto
      const panL = Math.cos((track.pan + 1) * Math.PI / 4)
      const panR = Math.sin((track.pan + 1) * Math.PI / 4)
      outL[start + i] += value * panL
      outR[start + i] += value * panR
      if (track.delay > 0) {
        const delayed = start + i + Math.floor(rate * 60 / bpm * 0.75)
        if (delayed < outL.length) { outL[delayed] += value * panL * track.delay * 0.38; outR[delayed] += value * panR * track.delay * 0.38 }
      }
    }
  }
}

function addAudio(outL: Float32Array, outR: Float32Array, clip: AudioClip, track: Track, startBeat: number, blockLength: number, offsetBeats: number, bpm: number, rate: number) {
  if (!clip.pcmBase64 || !clip.frames) return
  const source = base64ToFloats(clip.pcmBase64, clip.channels, clip.frames)
  const blockFrames = beatToSample(blockLength, bpm, rate)
  const targetStart = beatToSample(startBeat, bpm, rate)
  const trimStart = Math.floor(clip.trimStart * clip.sampleRate)
  const trimEnd = clip.frames - Math.floor(clip.trimEnd * clip.sampleRate)
  const usable = Math.max(1, trimEnd - trimStart)
  for (let i = 0; i < blockFrames && targetStart + i < outL.length; i++) {
    const beatInClip = (offsetBeats + i / rate * bpm / 60) % clip.lengthBeats
    const sourceOffset = beatInClip / clip.lengthBeats * usable
    const sourceIndex = trimStart + Math.min(usable - 1, Math.floor(sourceOffset))
    const autoIndex = Math.min(clip.volumeAutomation.length - 1, Math.floor(beatInClip / clip.lengthBeats * clip.volumeAutomation.length))
    const gain = track.volume * clip.gain * (clip.volumeAutomation[autoIndex] ?? 1)
    const l = source[0][sourceIndex] * gain
    const r = (source[1]?.[sourceIndex] ?? source[0][sourceIndex]) * gain
    const panL = Math.cos((track.pan + 1) * Math.PI / 4) * 1.414
    const panR = Math.sin((track.pan + 1) * Math.PI / 4) * 1.414
    outL[targetStart + i] += l * panL
    outR[targetStart + i] += r * panR
  }
}

export function renderProject(project: Project, durationBeats?: number, sampleRate = 44100, options: { skipInstrumentTracks?: boolean; finalize?: boolean } = {}): RenderResult {
  const inferredEnd = project.arrangement.reduce((end, block) => Math.max(end, block.startBeat + block.lengthBeats), 0)
  const beats = durationBeats ?? (inferredEnd || 16)
  if (!Number.isFinite(beats) || beats < 1 || beats > 512) throw new Error('Render duration must be between 1 and 512 beats.')
  const frames = beatToSample(beats, project.bpm, sampleRate)
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  const anySolo = project.tracks.some((track) => track.solo)
  for (const block of project.arrangement) {
    const track = project.tracks.find((candidate) => candidate.id === block.trackId)
    const clip = project.clips[block.clipId]
    if (!track || !clip || track.mute || (anySolo && !track.solo)) continue
    if (options.skipInstrumentTracks && track.instrument) continue
    if (clip.type === 'midi') addMidi(left, right, clip, track, block.startBeat, block.lengthBeats, block.offsetBeats, project.bpm, sampleRate)
    else addAudio(left, right, clip, track, block.startBeat, block.lengthBeats, block.offsetBeats, project.bpm, sampleRate)
  }
  if (options.finalize !== false) for (let i = 0; i < frames; i++) {
      left[i] = Math.tanh(left[i] * project.masterVolume)
      right[i] = Math.tanh(right[i] * project.masterVolume)
    }
  return { left, right, sampleRate, durationBeats: beats }
}

export function encodeWav(result: RenderResult): Uint8Array {
  const length = result.left.length
  const buffer = new ArrayBuffer(44 + length * 4)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + length * 4, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, result.sampleRate, true)
  view.setUint32(28, result.sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, length * 4, true)
  let offset = 44
  for (let i = 0; i < length; i++) for (const sample of [result.left[i], result.right[i]]) { view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7fff, true); offset += 2 }
  return new Uint8Array(buffer)
}
