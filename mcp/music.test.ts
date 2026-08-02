import { describe, expect, it } from 'vitest'
import { createBlankProject, createDemoProject, validateProject } from '../src/domain/project'
import { encodeWav, renderProject } from '../src/domain/render'
import {
  analyzeMix, decodeWav, duplicateClip, importWav, inspectProject, setArrangement,
  setClipAutomation, setClipNotes, setProjectSettings, setTrackMix,
} from './music'

describe('agent music operations', () => {
  it('composes, varies, arranges, mixes, and analyzes through domain objects', () => {
    let project = createBlankProject('Agent composition')
    project = setProjectSettings(project, { bpm: 96, loopStartBeat: 0, loopEndBeat: 32 })
    const pulseClip = project.tracks[0].sessionSlots[0]!
    project = setClipNotes(project, pulseClip, [{ step: 0, pitch: 36, velocity: 1 }, { step: 8, pitch: 36 }]).project
    const variation = duplicateClip(project, pulseClip, { name: 'Pulse variation', track: 'Pulse', slot: 1 })
    project = variation.project
    project = setClipNotes(project, variation.clip.id, [{ step: 0, pitch: 36 }, { step: 6, pitch: 36 }, { step: 11, pitch: 36 }]).project
    project = setArrangement(project, [{ track: 'Pulse', clip: variation.clip.id, startBeat: 0, lengthBeats: 32 }])
    project = setTrackMix(project, 'Pulse', { volume: 0.7, pan: -0.1, delay: 0.1 }).project
    project = setClipAutomation(project, variation.clip.id, [1, 0.9, 0.8, 1]).project
    expect(validateProject(project).arrangement).toHaveLength(1)
    const analysis = analyzeMix(project, 8, 8000)
    expect(analysis.peakDbfs).toBeGreaterThan(-120)
    expect(analysis.durationBeats).toBe(8)
  })

  it('decodes a rendered WAV and imports it without exposing PCM in inspection', () => {
    const sourceWav = encodeWav(renderProject(createDemoProject(), 1, 8000))
    const decoded = decodeWav(sourceWav)
    expect(decoded.sampleRate).toBe(8000)
    expect(decoded.channels).toHaveLength(2)
    let project = createBlankProject()
    const imported = importWav(project, sourceWav, { name: 'Rendered source', slot: 0 })
    project = validateProject(imported.project)
    const summary = inspectProject(project, 'song.resonant', 'revision')
    const audio = summary.clips.find((clip) => clip.id === imported.clip.id)
    expect(audio).toMatchObject({ type: 'audio', sampleRate: 8000 })
    expect(audio).not.toHaveProperty('pcmBase64')
    expect(imported.clip.waveformPeaks).toHaveLength(72)
  })

  it('rejects type-incompatible arrangement references', () => {
    const project = createBlankProject()
    const midiClip = project.tracks[0].sessionSlots[0]!
    expect(() => setArrangement(project, [{ track: 'Audio', clip: midiClip, startBeat: 0, lengthBeats: 4 }])).toThrow(/cannot play/i)
  })
})
