import type { AudioClip, Clip, Project, Track } from '../domain/types'
import { base64ToFloats, floatsToBase64 } from '../domain/pcm'
import { audioBufferFromChannels, prepareInstrument, renderSoundFontNote, scheduleSamplerNote, type PreparedInstrument } from './instrumentPlayback'

interface EngineOptions { mode: 'session' | 'arrangement'; activeClips: Record<string, string | null>; startBeat?: number; metronome?: boolean }

export class LiveEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private timer: number | null = null
  private startedAt = 0
  private startBeat = 0
  private nextStep = 0
  private project: Project | null = null
  private options: EngineOptions = { mode: 'session', activeClips: {} }
  private sources = new Set<AudioScheduledSourceNode>()
  private decoded = new Map<string, AudioBuffer>()
  private decodedSource = new Map<string, string>()
  private instruments = new Map<string, PreparedInstrument>()
  private soundFontNotes = new Map<string, AudioBuffer>()

  async prepare() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' })
      this.master = this.context.createGain()
      const compressor = this.context.createDynamicsCompressor()
      compressor.threshold.value = -3; compressor.knee.value = 8; compressor.ratio.value = 10; compressor.attack.value = 0.003; compressor.release.value = 0.18
      this.master.connect(compressor).connect(this.context.destination)
    }
    if (this.context.state === 'suspended') await this.context.resume()
    return this.context
  }

  async play(project: Project, options: EngineOptions) {
    const context = await this.prepare()
    this.stop()
    this.project = structuredClone(project)
    this.options = { ...options }
    this.startBeat = options.startBeat ?? 0
    this.startedAt = context.currentTime + 0.035
    this.nextStep = Math.ceil(this.startBeat * 4 - 1e-9)
    if (this.master) this.master.gain.value = project.masterVolume
    await Promise.all([this.cacheAudio(project), this.cacheInstruments(project)])
    this.tick()
    this.timer = window.setInterval(() => this.tick(), 25)
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    for (const source of this.sources) { try { source.stop() } catch { /* already stopped */ } }
    this.sources.clear()
  }

  isPlaying() { return this.timer !== null }
  getCurrentBeat() {
    if (!this.context || !this.isPlaying() || !this.project) return this.startBeat
    return this.startBeat + Math.max(0, this.context.currentTime - this.startedAt) * this.project.bpm / 60
  }
  getLatency() { return this.context ? Math.round((this.context.baseLatency + (this.context.outputLatency || 0)) * 1000) : null }
  updateProject(project: Project) { this.project = structuredClone(project); if (this.master) { this.master.gain.setTargetAtTime(project.masterVolume, this.context?.currentTime ?? 0, 0.015); void Promise.all([this.cacheAudio(project), this.cacheInstruments(project)]) } }
  setActiveClips(activeClips: Record<string, string | null>) { this.options.activeClips = { ...activeClips } }

  async getPreparedInstrument(id: string) {
    const context = await this.prepare()
    const existing = this.instruments.get(id)
    if (existing) return existing
    if (!window.resonantDesktop) throw new Error('Installed instruments require the Resonant desktop app.')
    const prepared = await prepareInstrument(context, await window.resonantDesktop.resolveInstrument(id))
    this.instruments.set(id, prepared)
    return prepared
  }

  async hydrateAudioAssets(project: Project) {
    await this.prepare()
    await this.cacheAudio(project)
    const clone = structuredClone(project)
    for (const clip of Object.values(clone.clips)) if (clip.type === 'audio' && clip.asset && !clip.pcmBase64) {
      const buffer = this.decoded.get(clip.id)
      if (!buffer) throw new Error(`Shared audio asset is unavailable for ${clip.name}.`)
      clip.pcmBase64 = floatsToBase64(Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index)))
      delete clip.asset
    }
    return clone
  }

  private async cacheAudio(project: Project) {
    if (!this.context) return
    const audioIds = new Set(Object.values(project.clips).filter((clip) => clip.type === 'audio').map((clip) => clip.id))
    for (const id of this.decoded.keys()) if (!audioIds.has(id)) { this.decoded.delete(id); this.decodedSource.delete(id) }
    for (const clip of Object.values(project.clips)) if (clip.type === 'audio') {
      const sourceKey = clip.asset ? `asset:${clip.asset.id}` : clip.pcmBase64 ? `embedded:${clip.pcmBase64}` : ''
      if (!sourceKey || this.decodedSource.get(clip.id) === sourceKey) continue
      let buffer: AudioBuffer
      if (clip.asset) {
        if (!window.resonantDesktop) throw new Error(`Shared audio asset ${clip.asset.id} requires the Resonant desktop app.`)
        buffer = await this.context.decodeAudioData((await window.resonantDesktop.resolveAudioAsset(clip.asset.id)).slice(0))
        if (buffer.sampleRate !== clip.sampleRate || buffer.length !== clip.frames || buffer.numberOfChannels !== clip.channels) throw new Error(`Shared audio asset metadata does not match ${clip.name}.`)
      } else {
        const channels = base64ToFloats(clip.pcmBase64!, clip.channels, clip.frames)
        buffer = this.context.createBuffer(clip.channels, clip.frames, clip.sampleRate)
        channels.forEach((data, index) => buffer.copyToChannel(new Float32Array(data), index))
      }
      this.decoded.set(clip.id, buffer)
      this.decodedSource.set(clip.id, sourceKey)
    }
  }

  private async cacheInstruments(project: Project) {
    if (!this.context || !window.resonantDesktop) return
    const references = new Map(project.tracks.filter((track) => track.instrument).map((track) => [track.instrument!.id, track.instrument!]))
    for (const id of this.instruments.keys()) if (!references.has(id)) this.instruments.delete(id)
    for (const [id] of references) if (!this.instruments.has(id)) {
      try {
        await this.getPreparedInstrument(id)
      } catch (error) { console.warn(`Instrument ${id} is unavailable; using the track fallback voice.`, error) }
    }
    const required = new Map<string, { track: Track; pitch: number; durationSteps: number }>()
    for (const track of project.tracks) if (track.instrument && this.instruments.get(track.instrument.id)?.kind === 'soundfont') {
      for (const clipId of track.sessionSlots) {
        const clip = clipId ? project.clips[clipId] : undefined
        if (clip?.type === 'midi') for (const note of clip.notes) required.set(`${track.instrument.id}:${note.pitch}:${note.durationSteps}:${project.bpm}`, { track, pitch: note.pitch, durationSteps: note.durationSteps })
      }
    }
    for (const [key, item] of required) if (!this.soundFontNotes.has(key)) {
      const prepared = this.instruments.get(item.track.instrument!.id)
      if (prepared?.kind !== 'soundfont') continue
      const duration = item.durationSteps * 0.25 * 60 / project.bpm
      const rendered = await renderSoundFontNote(prepared.data, prepared.instrument, item.pitch, duration, this.context.sampleRate)
      this.soundFontNotes.set(key, audioBufferFromChannels(this.context, rendered))
    }
  }

  async audition(project: Project, track: Track, pitch: number, velocity = 0.8) {
    const context = await this.prepare()
    this.project = structuredClone(project)
    await this.cacheInstruments(project)
    const when = context.currentTime + 0.01, output = this.trackOutput({ ...track, volume: Math.min(track.volume, 0.8), delay: 0 }, when)
    this.scheduleMidi(pitch, velocity, 2, track, when, project.bpm, output)
  }

  private tick() {
    const context = this.context, project = this.project
    if (!context || !project || !this.master) return
    let horizonBeat = this.startBeat + (context.currentTime + 0.12 - this.startedAt) * project.bpm / 60
    while (this.nextStep / 4 <= horizonBeat) {
      let beat = this.nextStep / 4
      let wrapped = false
      if (project.loop.enabled && this.options.mode === 'arrangement' && beat >= project.loop.endBeat) {
        this.startBeat = project.loop.startBeat
        this.startedAt = context.currentTime + 0.02
        this.nextStep = Math.ceil(project.loop.startBeat * 4 - 1e-9)
        beat = this.nextStep / 4
        horizonBeat = this.startBeat + (context.currentTime + 0.12 - this.startedAt) * project.bpm / 60
        wrapped = true
      }
      const when = this.startedAt + (beat - this.startBeat) * 60 / project.bpm
      this.scheduleAtStep(project, beat, Math.max(context.currentTime + 0.005, when))
      if (this.options.metronome && this.nextStep % 4 === 0) this.scheduleClick(when, this.nextStep % 16 === 0)
      this.nextStep++
      if (wrapped) break
    }
  }

  private scheduleAtStep(project: Project, beat: number, when: number) {
    const anySolo = project.tracks.some((track) => track.solo)
    for (const track of project.tracks) {
      if (track.mute || (anySolo && !track.solo)) continue
      if (this.options.mode === 'session') {
        const clipId = this.options.activeClips[track.id]
        const clip = clipId ? project.clips[clipId] : undefined
        if (clip) this.scheduleClip(clip, track, ((beat % clip.lengthBeats) + clip.lengthBeats) % clip.lengthBeats, when, project.bpm)
      } else {
        const blocks = project.arrangement.filter((candidate) => candidate.trackId === track.id && beat >= candidate.startBeat && beat < candidate.startBeat + candidate.lengthBeats)
        for (const block of blocks) {
          const clip = project.clips[block.clipId]
          if (!clip) continue
          const localBeat = ((beat - block.startBeat + block.offsetBeats) % clip.lengthBeats + clip.lengthBeats) % clip.lengthBeats
          this.scheduleClip(clip, track, localBeat, when, project.bpm)
        }
      }
    }
  }

  private scheduleClip(clip: Clip, track: Track, localBeat: number, when: number, bpm: number) {
    const step = Math.round(localBeat * 4) % Math.max(1, Math.round(clip.lengthBeats * 4))
    if (clip.type === 'midi') {
      for (const note of clip.notes.filter((candidate) => candidate.step === step)) this.scheduleMidi(note.pitch, note.velocity * (clip.volumeAutomation[step] ?? 1), note.durationSteps, track, when, bpm)
      return
    }
    const startingTransport = this.nextStep === Math.ceil(this.startBeat * 4 - 1e-9)
    if (step === 0 || startingTransport) this.scheduleAudio(clip, track, when, startingTransport ? localBeat : 0, bpm)
  }

  private trackOutput(track: Track, when: number) {
    const context = this.context!, gain = context.createGain(), pan = context.createStereoPanner()
    const delay = context.createDelay(2), feedback = context.createGain(), wet = context.createGain()
    gain.gain.setValueAtTime(track.volume, when); pan.pan.setValueAtTime(track.pan, when)
    delay.delayTime.value = this.project ? 60 / this.project.bpm * 0.75 : 0.375; feedback.gain.value = 0.25; wet.gain.value = track.delay
    gain.connect(pan).connect(this.master!); gain.connect(delay); delay.connect(feedback).connect(delay); delay.connect(wet).connect(this.master!)
    const dispose = () => { gain.disconnect(); pan.disconnect(); delay.disconnect(); feedback.disconnect(); wet.disconnect() }
    const tailMs = track.delay > 0 ? Math.max(750, delay.delayTime.value * 6000) : 0
    return { input: gain, dispose, tailMs }
  }

  private scheduleMidi(pitch: number, velocity: number, durationSteps: number, track: Track, when: number, bpm: number, suppliedOutput?: ReturnType<LiveEngine['trackOutput']>) {
    const context = this.context!, output = suppliedOutput ?? this.trackOutput(track, when)
    const prepared = track.instrument ? this.instruments.get(track.instrument.id) : undefined
    const duration = durationSteps * 0.25 * 60 / bpm
    if (prepared?.kind === 'sampler') {
      const scheduled = scheduleSamplerNote(context, prepared, pitch, velocity, when, duration, output.input, track.release)
      if (scheduled) {
        this.sources.add(scheduled.source)
        scheduled.source.onended = () => { this.sources.delete(scheduled.source); scheduled.dispose(); window.setTimeout(output.dispose, output.tailMs) }
      }
      return
    }
    if (prepared?.kind === 'soundfont') {
      const key = `${track.instrument!.id}:${pitch}:${durationSteps}:${bpm}`
      const buffer = this.soundFontNotes.get(key)
      if (buffer) {
        const source = context.createBufferSource(), gain = context.createGain()
        source.buffer = buffer; gain.gain.value = velocity; source.connect(gain).connect(output.input)
        this.sources.add(source); source.onended = () => { this.sources.delete(source); gain.disconnect(); window.setTimeout(output.dispose, output.tailMs) }
        source.start(when); return
      }
    }
    const envelope = context.createGain(), filter = context.createBiquadFilter()
    envelope.gain.setValueAtTime(0.0001, when); envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, velocity), when + Math.max(0.003, track.attack))
    envelope.gain.setValueAtTime(Math.max(0.001, velocity), when + duration)
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration + track.release)
    filter.type = 'lowpass'; filter.frequency.value = track.filterHz; filter.Q.value = 0.8
    envelope.connect(filter).connect(output.input)
    let source: AudioScheduledSourceNode
    if (track.kind === 'drum' && pitch > 36) {
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.25), context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const noise = context.createBufferSource(); noise.buffer = buffer; source = noise
    } else {
      const oscillator = context.createOscillator(); oscillator.type = track.kind === 'drum' ? 'sine' : track.waveform; oscillator.frequency.setValueAtTime(440 * 2 ** ((pitch - 69) / 12), when)
      if (track.kind === 'drum') oscillator.frequency.exponentialRampToValueAtTime(42, when + 0.09)
      source = oscillator
    }
    source.connect(envelope); this.sources.add(source); source.onended = () => { this.sources.delete(source); envelope.disconnect(); filter.disconnect(); window.setTimeout(output.dispose, output.tailMs) }
    source.start(when); source.stop(when + duration + track.release + 0.03)
  }

  private scheduleAudio(clip: AudioClip, track: Track, when: number, localBeat: number, bpm: number) {
    const buffer = this.decoded.get(clip.id)
    if (!buffer) return
    const source = this.context!.createBufferSource(), gain = this.context!.createGain(), output = this.trackOutput(track, when)
    const usableDuration = Math.max(1 / buffer.sampleRate, buffer.duration - clip.trimStart - clip.trimEnd)
    const beatFraction = Math.max(0, Math.min(1, localBeat / clip.lengthBeats))
    const sourceOffset = clip.trimStart + usableDuration * beatFraction
    const sourceDuration = Math.max(1 / buffer.sampleRate, usableDuration * (1 - beatFraction))
    const targetDuration = Math.max(0.01, (clip.lengthBeats - localBeat) * 60 / bpm)
    source.buffer = buffer; source.playbackRate.value = sourceDuration / targetDuration; gain.gain.value = clip.gain; source.connect(gain).connect(output.input)
    this.sources.add(source); source.onended = () => { this.sources.delete(source); gain.disconnect(); window.setTimeout(output.dispose, output.tailMs) }
    source.start(when, sourceOffset, sourceDuration); source.stop(when + targetDuration + 0.02)
  }

  private scheduleClick(when: number, accent: boolean) {
    const oscillator = this.context!.createOscillator(), gain = this.context!.createGain()
    oscillator.frequency.value = accent ? 1380 : 940; gain.gain.setValueAtTime(0.14, when); gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.035)
    oscillator.connect(gain).connect(this.master!); oscillator.start(when); oscillator.stop(when + 0.04)
  }
}

export const liveEngine = new LiveEngine()
