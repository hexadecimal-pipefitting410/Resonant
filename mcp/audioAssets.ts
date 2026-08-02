import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { base64ToFloats, floatsToBase64 } from '../src/domain/pcm'
import type { AudioClip, Project } from '../src/domain/types'
import { encodePcm16Wav } from '../src/domain/wavAsset'
import { decodeWav } from './music'

export function audioAssetRoot() {
  return process.env.RESONANT_AUDIO_ASSET_ROOT || path.join(process.env.APPDATA || path.join(process.env.USERPROFILE || '.', 'AppData', 'Roaming'), 'resonant-workstation', 'audio-assets')
}

function location(id: string) { return path.join(audioAssetRoot(), `${id}.wav`) }

async function storeCanonical(wav: Uint8Array) {
  const id = createHash('sha256').update(wav).digest('hex')
  const target = location(id)
  await mkdir(audioAssetRoot(), { recursive: true })
  try { await access(target) } catch {
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporary, wav, { flag: 'wx' })
    await rename(temporary, target)
  }
  return { id, sha256: id, bytes: wav.byteLength, format: 'wav-pcm16' as const }
}

export async function storeWavAsset(bytes: Uint8Array) {
  const decoded = decodeWav(bytes)
  return storeCanonical(encodePcm16Wav(decoded.channels, decoded.sampleRate))
}

export async function storeEmbeddedClipAsset(clip: AudioClip) {
  if (!clip.pcmBase64) throw new Error(`${clip.name} does not contain legacy embedded audio.`)
  return storeCanonical(encodePcm16Wav(base64ToFloats(clip.pcmBase64, clip.channels, clip.frames), clip.sampleRate))
}

export async function readAudioAsset(id: string) {
  if (!/^[a-f0-9]{64}$/i.test(id)) throw new Error('Invalid shared audio asset ID.')
  try { return new Uint8Array(await readFile(location(id))) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`Shared audio asset is missing: ${id}.`); throw error }
}

export async function hydrateProjectAudioAssets(project: Project) {
  const clone = structuredClone(project)
  for (const clip of Object.values(clone.clips)) if (clip.type === 'audio' && !clip.pcmBase64 && clip.asset) {
    const decoded = decodeWav(await readAudioAsset(clip.asset.id))
    if (decoded.sampleRate !== clip.sampleRate || decoded.frames !== clip.frames || decoded.channels.length !== clip.channels) throw new Error(`Shared audio asset metadata does not match clip ${clip.name}.`)
    clip.pcmBase64 = floatsToBase64(decoded.channels)
  }
  return clone
}
