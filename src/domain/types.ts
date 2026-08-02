import type { SongwritingDraft } from '../songwriting/types'

export type TrackKind = 'drum' | 'synth' | 'sampler' | 'audio'
export type Waveform = 'sine' | 'triangle' | 'sawtooth' | 'square'

export interface InstrumentRef {
  id: string
  name: string
  packName?: string
  format: 'soundfont' | 'webaudiofont' | 'sfz' | 'sample'
  program?: number
  bankMSB?: number
  bankLSB?: number
  percussion?: boolean
}

export interface MidiNote {
  id: string
  step: number
  pitch: number
  velocity: number
  durationSteps: number
}

export interface MidiClip {
  id: string
  type: 'midi'
  name: string
  color: string
  lengthBeats: number
  notes: MidiNote[]
  volumeAutomation: number[]
}

export interface AudioClip {
  id: string
  type: 'audio'
  name: string
  color: string
  lengthBeats: number
  sampleRate: number
  channels: 1 | 2
  frames: number
  pcmBase64?: string
  asset?: {
    id: string
    sha256: string
    bytes: number
    format: 'wav-pcm16'
  }
  waveformPeaks?: number[]
  trimStart: number
  trimEnd: number
  gain: number
  volumeAutomation: number[]
}

export type Clip = MidiClip | AudioClip

export interface Track {
  id: string
  name: string
  kind: TrackKind
  color: string
  volume: number
  pan: number
  mute: boolean
  solo: boolean
  armed: boolean
  delay: number
  waveform: Waveform
  attack: number
  release: number
  filterHz: number
  instrument?: InstrumentRef
  sessionSlots: Array<string | null>
}

export interface ArrangementBlock {
  id: string
  trackId: string
  clipId: string
  startBeat: number
  lengthBeats: number
  offsetBeats: number
}

export interface Project {
  schemaVersion: 1
  id: string
  title: string
  bpm: number
  meter: [number, number]
  masterVolume: number
  loop: { enabled: boolean; startBeat: number; endBeat: number }
  tracks: Track[]
  clips: Record<string, Clip>
  arrangement: ArrangementBlock[]
  songwriting?: SongwritingDraft
  createdAt: string
  modifiedAt: string
}

export type Workspace = 'flow' | 'arrange' | 'mix'
export type PlayMode = 'session' | 'arrangement'

export interface EngineState {
  playing: boolean
  recording: boolean
  beat: number
  mode: PlayMode
  activeClips: Record<string, string | null>
}
