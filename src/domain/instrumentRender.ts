import { prepareInstrument, renderSoundFontNote, type PreparedInstrument, type PreparedSampler } from '../audio/instrumentPlayback'
import { chooseZone, type ResolvedInstrument } from './instruments'
import { renderProject, type RenderResult } from './render'
import { beatToSample, stepToBeat } from './time'
import type { MidiClip, Project, Track } from './types'

type Resolver = (id: string) => Promise<ResolvedInstrument | PreparedInstrument>

function addDelay(result: RenderResult, index: number, left: number, right: number, track: Track, bpm: number) {
  result.left[index] += left; result.right[index] += right
  if (track.delay <= 0) return
  const delayed = index + Math.floor(result.sampleRate * 60 / bpm * 0.75)
  if (delayed < result.left.length) { result.left[delayed] += left * track.delay * 0.38; result.right[delayed] += right * track.delay * 0.38 }
}

function addSamplerNote(result: RenderResult, prepared: PreparedSampler, track: Track, pitch: number, velocity: number, start: number, duration: number, automation: number, bpm: number) {
  const zone = chooseZone(prepared.zones, pitch, velocity)
  if (!zone || !('buffer' in zone)) return
  const buffer = zone.buffer as AudioBuffer
  const root = zone.rootKey ?? Math.round((zone.originalPitch ?? 6000) / 100)
  const cents = (pitch - root) * 100 - (zone.coarseTune ?? 0) * 100 - (zone.fineTune ?? zone.tune ?? 0)
  const playbackRate = 2 ** (cents / 1200), sourceFrames = buffer.length
  const maxFrames = zone.oneShot ? Math.ceil(sourceFrames / playbackRate) : Math.ceil((duration + track.release) * result.sampleRate)
  const gain = velocity * automation * track.volume * 10 ** ((zone.gainDb ?? 0) / 20)
  const panL = Math.cos((track.pan + 1) * Math.PI / 4), panR = Math.sin((track.pan + 1) * Math.PI / 4)
  for (let frame = 0; frame < maxFrames && start + frame < result.left.length; frame++) {
    let sourceIndex = Math.floor(frame * playbackRate * buffer.sampleRate / result.sampleRate)
    if (sourceIndex >= sourceFrames) {
      if (zone.loopMode && !['no_loop', 'one_shot'].includes(zone.loopMode) && (zone.loopEnd ?? 0) > (zone.loopStart ?? 0)) sourceIndex = (zone.loopStart ?? 0) + ((sourceIndex - (zone.loopStart ?? 0)) % ((zone.loopEnd ?? sourceFrames) - (zone.loopStart ?? 0)))
      else break
    }
    const t = frame / result.sampleRate
    const release = zone.oneShot || t <= duration ? 1 : Math.max(0, 1 - (t - duration) / Math.max(0.02, track.release))
    const left = buffer.getChannelData(0)[sourceIndex] ?? 0
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1)[sourceIndex] ?? left : left
    addDelay(result, start + frame, left * gain * release * panL, right * gain * release * panR, track, bpm)
  }
}

function noteEvents(clip: MidiClip, startBeat: number, blockLength: number, offsetBeats: number) {
  const events: Array<{ pitch: number; velocity: number; durationSteps: number; beat: number; automation: number }> = []
  const loops = Math.ceil((blockLength + offsetBeats) / clip.lengthBeats)
  for (let loop = 0; loop < loops; loop++) for (const note of clip.notes) {
    const relativeBeat = loop * clip.lengthBeats + stepToBeat(note.step) - offsetBeats
    if (relativeBeat < 0 || relativeBeat >= blockLength) continue
    events.push({ pitch: note.pitch, velocity: note.velocity, durationSteps: note.durationSteps, beat: startBeat + relativeBeat, automation: clip.volumeAutomation[note.step] ?? 1 })
  }
  return events
}

export async function renderProjectWithInstruments(project: Project, resolver: Resolver, decodeContext: BaseAudioContext, durationBeats?: number, sampleRate = 44100) {
  const result = renderProject(project, durationBeats, sampleRate, { skipInstrumentTracks: true, finalize: false })
  const anySolo = project.tracks.some((track) => track.solo)
  const prepared = new Map<string, PreparedInstrument>()
  for (const track of project.tracks) if (track.instrument && !track.mute && (!anySolo || track.solo) && !prepared.has(track.instrument.id)) {
    const resolved = await resolver(track.instrument.id)
    prepared.set(track.instrument.id, 'kind' in resolved ? resolved : await prepareInstrument(decodeContext, resolved))
  }
  const soundFontCache = new Map<string, Awaited<ReturnType<typeof renderSoundFontNote>>>()
  for (const block of project.arrangement) {
    const track = project.tracks.find((candidate) => candidate.id === block.trackId), clip = project.clips[block.clipId]
    if (!track?.instrument || clip?.type !== 'midi' || track.mute || (anySolo && !track.solo)) continue
    const source = prepared.get(track.instrument.id)
    if (!source) continue
    for (const event of noteEvents(clip, block.startBeat, block.lengthBeats, block.offsetBeats)) {
      const start = beatToSample(event.beat, project.bpm, sampleRate), duration = event.durationSteps * 0.25 * 60 / project.bpm
      if (source.kind === 'sampler') addSamplerNote(result, source, track, event.pitch, event.velocity, start, duration, event.automation, project.bpm)
      else {
        const key = `${track.instrument.id}:${event.pitch}:${event.durationSteps}:${project.bpm}:${sampleRate}`
        let note = soundFontCache.get(key)
        if (!note) { note = await renderSoundFontNote(source.data, source.instrument, event.pitch, duration, sampleRate); soundFontCache.set(key, note) }
        const gain = event.velocity * event.automation * track.volume
        const panL = Math.cos((track.pan + 1) * Math.PI / 4), panR = Math.sin((track.pan + 1) * Math.PI / 4)
        for (let frame = 0; frame < note.left.length && start + frame < result.left.length; frame++) addDelay(result, start + frame, note.left[frame] * gain * panL, note.right[frame] * gain * panR, track, project.bpm)
      }
    }
  }
  for (let frame = 0; frame < result.left.length; frame++) {
    result.left[frame] = Math.tanh(result.left[frame] * project.masterVolume)
    result.right[frame] = Math.tanh(result.right[frame] * project.masterVolume)
  }
  return result
}
