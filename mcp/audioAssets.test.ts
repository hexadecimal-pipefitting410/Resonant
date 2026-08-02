import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBlankProject, validateProject } from '../src/domain/project'
import { encodePcm16Wav } from '../src/domain/wavAsset'
import { hydrateProjectAudioAssets, storeWavAsset } from './audioAssets'
import { importWav, renderWav } from './music'

const temporary: string[] = []
const previousRoot = process.env.RESONANT_AUDIO_ASSET_ROOT
afterEach(async () => { if (previousRoot === undefined) delete process.env.RESONANT_AUDIO_ASSET_ROOT; else process.env.RESONANT_AUDIO_ASSET_ROOT = previousRoot; await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

describe('content-addressed audio assets', () => {
  it('deduplicates canonical WAV data and hydrates a small valid project for rendering', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'resonant-assets-')); temporary.push(root); process.env.RESONANT_AUDIO_ASSET_ROOT = root
    const channel = Float32Array.from({ length: 8000 }, (_, index) => Math.sin(index / 20) * 0.2)
    const wav = encodePcm16Wav([channel], 8000)
    const first = await storeWavAsset(wav), second = await storeWavAsset(wav)
    expect(second).toEqual(first)
    const project = createBlankProject('External audio')
    const imported = importWav(project, wav, { name: 'Shared take', slot: 0, asset: first })
    expect(imported.clip.pcmBase64).toBeUndefined()
    expect(validateProject(imported.project).clips[imported.clip.id]).toMatchObject({ asset: { id: first.id } })
    const hydrated = await hydrateProjectAudioAssets(imported.project)
    expect((hydrated.clips[imported.clip.id] as typeof imported.clip).pcmBase64).toBeTruthy()
    hydrated.arrangement = [{ id: 'asset-block', trackId: hydrated.tracks.find((track) => track.kind === 'audio')!.id, clipId: imported.clip.id, startBeat: 0, lengthBeats: 2, offsetBeats: 0 }]
    expect(renderWav(hydrated, 2).byteLength).toBeGreaterThan(44)
  })
})
