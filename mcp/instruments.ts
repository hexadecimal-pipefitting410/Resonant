import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { InstrumentRef, Project } from '../src/domain/types'
import { resolveTrack } from './music'

interface ManifestInstrument extends InstrumentRef { family?: string; file?: string; zones?: Array<Record<string, unknown>> }
interface Manifest { id: string; name: string; version: string; format: string; bytes: number; installedAt: string; instruments: ManifestInstrument[] }

export function defaultInstrumentRoot() {
  if (process.env.RESONANT_INSTRUMENT_ROOT) return path.resolve(process.env.RESONANT_INSTRUMENT_ROOT)
  const appData = process.env.APPDATA
  if (!appData) return path.resolve('.resonant-instruments')
  return path.join(appData, 'resonant-workstation', 'instrument-library')
}

async function readManifests(root = defaultInstrumentRoot()) {
  const packsRoot = path.join(root, 'packs')
  let entries
  try { entries = await readdir(packsRoot, { withFileTypes: true }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const output: Array<{ directory: string; manifest: Manifest }> = []
  for (const entry of entries) if (entry.isDirectory()) {
    try { output.push({ directory: path.join(packsRoot, entry.name), manifest: JSON.parse(await readFile(path.join(packsRoot, entry.name, 'manifest.json'), 'utf8')) }) } catch { /* incomplete pack */ }
  }
  return output
}

export async function listInstalledInstruments(root = defaultInstrumentRoot()) {
  const packs = await readManifests(root)
  return {
    root,
    packs: packs.map(({ manifest }) => ({ id: manifest.id, name: manifest.name, version: manifest.version, format: manifest.format, bytes: manifest.bytes, installedAt: manifest.installedAt, instrumentCount: manifest.instruments?.length || 0 })),
    instruments: packs.flatMap(({ manifest }) => (manifest.instruments || []).map((instrument) => ({ ...instrument, id: `${manifest.id}:${instrument.id}`, packId: manifest.id, packName: manifest.name, family: instrument.family || 'Other' }))),
  }
}

export async function getInstalledInstrument(reference: string, root = defaultInstrumentRoot()) {
  const separator = reference.indexOf(':')
  if (separator < 1) throw new Error('Instrument reference must come from list_instruments.')
  const packId = reference.slice(0, separator), instrumentId = reference.slice(separator + 1)
  const packs = await readManifests(root)
  const found = packs.find(({ manifest }) => manifest.id === packId)
  const instrument = found?.manifest.instruments.find((candidate) => candidate.id === instrumentId)
  if (!found || !instrument) throw new Error(`Installed instrument not found: ${reference}`)
  const summary: InstrumentRef = { id: reference, name: instrument.name, packName: found.manifest.name, format: instrument.format, program: instrument.program, bankMSB: instrument.bankMSB, bankLSB: instrument.bankLSB, percussion: instrument.percussion }
  if (instrument.format !== 'soundfont' || !instrument.file) return { summary, directory: found.directory, instrument }
  const data = await readFile(path.join(found.directory, instrument.file))
  return { summary, directory: found.directory, instrument, data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) }
}

export function assignInstrument(project: Project, trackReference: string, instrument: InstrumentRef | null) {
  const selected = resolveTrack(project, trackReference)
  if (selected.kind === 'audio') throw new Error('Audio tracks cannot host playable instruments.')
  const track = { ...selected, kind: instrument ? (instrument.percussion ? 'drum' as const : 'sampler' as const) : (selected.kind === 'drum' ? 'drum' as const : 'synth' as const), instrument: instrument ?? undefined }
  return { project: { ...project, tracks: project.tracks.map((candidate) => candidate.id === track.id ? track : candidate) }, track }
}
