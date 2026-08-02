import { describe, expect, it } from 'vitest'
import { createBlankProject, createDemoProject, parseProject, serializeProject, validateProject } from './project'
import { floatsToBase64, summarizeWaveform } from './pcm'
import { beatToSample, beatToSeconds, formatBeat, quantizeBeat } from './time'
import { encodeWav, renderProject } from './render'
import { initialState, reducer } from '../store/AppStore'
import type { AudioClip, MidiClip } from './types'

describe('musical time', () => {
  it('converts and rounds boundaries deterministically', () => {
    expect(beatToSeconds(4, 120)).toBe(2)
    expect(beatToSample(0.25, 120, 44100)).toBe(5513)
    expect(quantizeBeat(1.13)).toBe(1.25)
    expect(formatBeat(4.25)).toBe('02.1.2')
  })
})

describe('project persistence', () => {
  it('round trips a valid project', () => {
    const project = createBlankProject()
    expect(parseProject(serializeProject(project))).toEqual(project)
  })
  it('rejects damaged references', () => {
    const project = createDemoProject()
    project.arrangement[0].clipId = 'missing'
    expect(() => validateProject(project)).toThrow(/missing material/)
  })
  it('rejects incompatible clip routing and unsafe embedded audio', () => {
    const incompatible = createBlankProject()
    incompatible.tracks.find((track) => track.kind === 'audio')!.sessionSlots[0] = incompatible.tracks[0].sessionSlots[0]
    expect(() => validateProject(incompatible)).toThrow(/cannot play midi clip/i)

    const damaged = createBlankProject()
    const track = damaged.tracks.find((candidate) => candidate.kind === 'audio')!
    const pcm = new Float32Array(8000)
    const clip: AudioClip = {
      id: 'audio-test', type: 'audio', name: 'Audio test', color: track.color, lengthBeats: 2,
      sampleRate: 8000, channels: 1, frames: pcm.length, pcmBase64: floatsToBase64([pcm]),
      trimStart: 0.5, trimEnd: 0.5, gain: 1, volumeAutomation: Array(16).fill(1),
    }
    damaged.clips[clip.id] = clip; track.sessionSlots[0] = clip.id
    expect(() => validateProject(damaged)).toThrow(/trim removes all audio/i)
    clip.trimEnd = 0; clip.pcmBase64 = clip.pcmBase64!.slice(4)
    expect(() => validateProject(damaged)).toThrow(/audio data is invalid/i)
  })
})

describe('offline render', () => {
  it('is deterministic and emits a stereo wav', () => {
    const project = createDemoProject()
    const a = encodeWav(renderProject(project, 4, 8000))
    const b = encodeWav(renderProject(project, 4, 8000))
    expect(a).toEqual(b)
    expect(new TextDecoder().decode(a.slice(0, 4))).toBe('RIFF')
    expect(a.length).toBe(44 + 4 * 60 / 120 * 8000 * 4)
    expect(a.slice(44).some((value) => value !== 0)).toBe(true)
  })
  it('honors arrangement clip offsets', () => {
    const project = createBlankProject()
    const track = project.tracks[0]
    const clip = project.clips[track.sessionSlots[0]!] as MidiClip
    clip.notes = [{ id: 'offset-note', step: 0, pitch: 36, velocity: 1, durationSteps: 1 }]
    project.arrangement = [{ id: 'offset-block', trackId: track.id, clipId: clip.id, startBeat: 0, lengthBeats: 4, offsetBeats: 1 }]
    const rendered = renderProject(project, 4, 8000)
    const beforeWrappedNote = rendered.left.slice(0, beatToSample(2.9, project.bpm, 8000))
    const wrappedNote = rendered.left.slice(beatToSample(3, project.bpm, 8000), beatToSample(3.2, project.bpm, 8000))
    expect(beforeWrappedNote.some((sample) => sample !== 0)).toBe(false)
    expect(wrappedNote.some((sample) => sample !== 0)).toBe(true)
  })
  it('rejects render requests beyond the bounded offline limit', () => {
    expect(() => renderProject(createDemoProject(), 513, 8000)).toThrow(/between 1 and 512 beats/i)
  })
})

describe('audio summaries', () => {
  it('derives bounded waveform peaks from PCM', () => {
    expect(summarizeWaveform([new Float32Array([0, -0.5, 0.25, 2])], 2)).toEqual([0.5, 1])
  })
})

describe('command history', () => {
  it('undoes and redoes a project transaction', () => {
    const state = initialState()
    const renamed = { ...state.project, title: 'A deliberate change' }
    const committed = reducer(state, { type: 'commit', project: renamed, label: 'Rename project' })
    expect(committed.project.title).toBe('A deliberate change')
    const undone = reducer(committed, { type: 'undo' })
    expect(undone.project.title).toBe('Untitled piece')
    expect(reducer(undone, { type: 'redo' }).project.title).toBe('A deliberate change')
  })
})
