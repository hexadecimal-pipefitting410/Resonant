import { chooseZone, type ResolvedInstrument, type SampleZone } from '../domain/instruments'
import type { InstrumentRef } from '../domain/types'

export interface DecodedZone extends SampleZone { buffer: AudioBuffer }
export interface PreparedSampler { kind: 'sampler'; instrument: InstrumentRef; zones: DecodedZone[] }
export interface PreparedSoundFont { kind: 'soundfont'; instrument: InstrumentRef; data: ArrayBuffer }
export type PreparedInstrument = PreparedSampler | PreparedSoundFont

function base64Bytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer
}

async function decodeZones(context: BaseAudioContext, zones: SampleZone[]) {
  const output = await Promise.all(zones.map(async (zone) => {
    const encoded = zone.data ?? (typeof zone.file === 'string' ? base64Bytes(zone.file) : undefined)
    if (!encoded) return null
    const buffer = await context.decodeAudioData(encoded.slice(0))
    return { ...zone, buffer } as DecodedZone
  }))
  return output.filter((zone): zone is DecodedZone => !!zone)
}

export async function prepareInstrument(context: BaseAudioContext, resolved: ResolvedInstrument): Promise<PreparedInstrument> {
  if (resolved.instrument.format === 'soundfont') {
    if (!resolved.data) throw new Error(`${resolved.instrument.name} has no SoundFont data.`)
    return { kind: 'soundfont', instrument: resolved.instrument, data: resolved.data }
  }
  const rawZones = resolved.zones ?? resolved.preset?.zones ?? []
  const zones = await decodeZones(context, rawZones)
  if (!zones.length) throw new Error(`${resolved.instrument.name} contains no decodable sample zones.`)
  return { kind: 'sampler', instrument: resolved.instrument, zones }
}

export function scheduleSamplerNote(context: BaseAudioContext, prepared: PreparedSampler, pitch: number, velocity: number, when: number, duration: number, destination: AudioNode, release: number) {
  const zone = chooseZone(prepared.zones, pitch, velocity) as DecodedZone | undefined
  if (!zone) return null
  const source = context.createBufferSource(), gain = context.createGain()
  const rootKey = zone.rootKey ?? Math.round((zone.originalPitch ?? 6000) / 100)
  const cents = (pitch - rootKey) * 100 - (zone.coarseTune ?? 0) * 100 - (zone.fineTune ?? zone.tune ?? 0)
  source.buffer = zone.buffer
  source.detune.value = cents
  const linearGain = 10 ** ((zone.gainDb ?? 0) / 20)
  gain.gain.setValueAtTime(Math.max(0.0001, velocity * linearGain), when)
  const noteEnd = when + Math.max(0.03, duration)
  const stopAt = zone.oneShot ? when + zone.buffer.duration / source.playbackRate.value : noteEnd + release
  if (!zone.oneShot) {
    gain.gain.setValueAtTime(Math.max(0.0001, velocity * linearGain), noteEnd)
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd + Math.max(0.02, release))
  }
  if (zone.loopMode && !['no_loop', 'one_shot'].includes(zone.loopMode) && (zone.loopEnd ?? 0) > (zone.loopStart ?? 0)) {
    source.loop = true
    source.loopStart = (zone.loopStart ?? 0) / zone.buffer.sampleRate
    source.loopEnd = (zone.loopEnd ?? 0) / zone.buffer.sampleRate
  }
  source.connect(gain).connect(destination)
  source.start(when)
  source.stop(Math.max(when + 0.02, stopAt))
  return { source, dispose: () => gain.disconnect() }
}

function exactArrayBuffer(value: ArrayBuffer) { return value.slice(0) }

export async function renderSoundFontNote(data: ArrayBuffer, instrument: InstrumentRef, pitch: number, durationSeconds: number, sampleRate: number) {
  const { MIDIControllers, SoundBankLoader, SpessaSynthProcessor } = await import('spessasynth_core')
  const soundBank = SoundBankLoader.fromArrayBuffer(exactArrayBuffer(data))
  const synth = new SpessaSynthProcessor(sampleRate, { eventsEnabled: false })
  synth.soundBankManager.addSoundBank(soundBank, 'resonant')
  await synth.processorInitialized
  synth.setSystemParameter('autoAllocateVoices', true)
  const channel = instrument.percussion ? 9 : 0
  synth.midiChannels[channel].setDrums(!!instrument.percussion)
  synth.controllerChange(channel, MIDIControllers.bankSelect, instrument.bankMSB ?? 0)
  synth.controllerChange(channel, MIDIControllers.bankSelectLSB, instrument.bankLSB ?? 0)
  synth.programChange(channel, instrument.program ?? 0)
  synth.noteOn(channel, pitch, 127)
  const tail = instrument.percussion ? 1.2 : 1.8
  const frames = Math.ceil((durationSeconds + tail) * sampleRate)
  const left = new Float32Array(frames), right = new Float32Array(frames)
  const block = 128, noteOffFrame = Math.floor(durationSeconds * sampleRate)
  let offset = 0, released = false
  while (offset < frames) {
    if (!released && offset >= noteOffFrame) { synth.noteOff(channel, pitch); released = true }
    const count = Math.min(block, frames - offset)
    synth.process(left, right, offset, count)
    offset += count
  }
  synth.destroySynthProcessor()
  return { left, right, sampleRate }
}

export function audioBufferFromChannels(context: BaseAudioContext, channels: { left: Float32Array; right: Float32Array; sampleRate: number }) {
  const buffer = context.createBuffer(2, channels.left.length, channels.sampleRate)
  buffer.copyToChannel(new Float32Array(channels.left), 0); buffer.copyToChannel(new Float32Array(channels.right), 1)
  return buffer
}
