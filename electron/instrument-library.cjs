const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const WEBAUDIOFONT_CATALOG = 'https://webaudiofonts.com/presets/catalog.json'
const GENERAL_USER_URL = 'https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/master/GeneralUser-GS.sf2'

const FAMILY_BY_PROGRAM = ['Piano', 'Chromatic Percussion', 'Organ', 'Guitar', 'Bass', 'Strings', 'Ensemble', 'Brass', 'Reed', 'Pipe', 'Synth Lead', 'Synth Pad', 'Synth Effects', 'Ethnic', 'Percussion', 'Sound Effects']

function safeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'instrument'
}

function libraryRoot(app) {
  return process.env.RESONANT_INSTRUMENT_ROOT || path.join(app.getPath('userData'), 'instrument-library')
}

async function ensureRoot(root) {
  await fs.mkdir(path.join(root, 'packs'), { recursive: true })
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true })
}

async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')) }

async function manifests(root) {
  await ensureRoot(root)
  const entries = await fs.readdir(path.join(root, 'packs'), { withFileTypes: true })
  const found = []
  for (const entry of entries) if (entry.isDirectory()) {
    try { found.push(await readJson(path.join(root, 'packs', entry.name, 'manifest.json'))) } catch { /* incomplete pack */ }
  }
  return found
}

function flatten(manifest) {
  return (manifest.instruments || []).map((instrument) => ({
    ...instrument,
    id: `${manifest.id}:${instrument.id}`,
    packId: manifest.id,
    packName: manifest.name,
    installed: true,
  }))
}

async function state(root) {
  const packs = await manifests(root)
  let bytes = 0
  for (const pack of packs) bytes += Number(pack.bytes || 0)
  return { root, packs: packs.map(({ instruments, ...pack }) => ({ ...pack, instrumentCount: instruments?.length || 0 })), instruments: packs.flatMap(flatten), bytes }
}

async function writeManifest(directory, manifest) {
  await fs.mkdir(directory, { recursive: true })
  const target = path.join(directory, 'manifest.json')
  const temp = `${target}.saving-${process.pid}`
  await fs.writeFile(temp, JSON.stringify(manifest, null, 2))
  await fs.unlink(target).catch(() => undefined)
  await fs.rename(temp, target)
}

async function download(url, target, progress) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status} ${response.statusText}).`)
  const total = Number(response.headers.get('content-length') || 0)
  const temp = `${target}.download-${process.pid}`
  const handle = await fs.open(temp, 'w')
  let received = 0
  try {
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await handle.write(value)
      received += value.byteLength
      progress?.({ received, total })
    }
  } catch (error) {
    await handle.close().catch(() => undefined)
    await fs.unlink(temp).catch(() => undefined)
    throw error
  }
  await handle.close()
  await fs.unlink(target).catch(() => undefined)
  await fs.rename(temp, target)
  return received
}

async function soundFontInstruments(file) {
  const { SoundBankLoader } = await import('spessasynth_core')
  const buffer = await fs.readFile(file)
  const bank = SoundBankLoader.fromArrayBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  return bank.presets.map((preset, index) => ({
    id: `preset-${index}-${safeId(preset.name)}`,
    name: preset.name || `Preset ${index + 1}`,
    family: preset.isDrum ? 'Drums' : FAMILY_BY_PROGRAM[Math.floor(preset.program / 8)] || 'Other',
    format: 'soundfont', file: path.basename(file), program: preset.program, bankMSB: preset.bankMSB,
    bankLSB: preset.bankLSB, percussion: preset.isDrum,
  }))
}

async function installGeneralUser(root, progress) {
  const id = 'generaluser-gs'
  const directory = path.join(root, 'packs', id)
  await fs.mkdir(directory, { recursive: true })
  const file = path.join(directory, 'GeneralUser-GS.sf2')
  progress?.({ phase: 'download', label: 'Downloading GeneralUser GS', received: 0, total: 0 })
  const bytes = await download(GENERAL_USER_URL, file, (value) => progress?.({ phase: 'download', label: 'Downloading GeneralUser GS', ...value }))
  progress?.({ phase: 'index', label: 'Indexing 260+ presets', received: bytes, total: bytes })
  const instruments = await soundFontInstruments(file)
  await writeManifest(directory, {
    schemaVersion: 1, id, name: 'GeneralUser GS', version: 'current', format: 'soundfont', bytes,
    source: GENERAL_USER_URL, installedAt: new Date().toISOString(), instruments,
  })
  return { id, name: 'GeneralUser GS', bytes, instrumentCount: instruments.length }
}

async function webAudioCatalog(query = '') {
  const response = await fetch(WEBAUDIOFONT_CATALOG)
  if (!response.ok) throw new Error(`WebAudioFont catalog failed (${response.status}).`)
  const catalog = await response.json()
  const needles = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const results = []
  for (const category of catalog.categories || []) for (const instrument of category.instruments || []) for (const preset of instrument.presets || []) {
    const haystack = `${category.name} ${instrument.name} ${preset.name} ${preset.id}`.toLowerCase()
    if (needles.length && !needles.some((needle) => haystack.includes(needle))) continue
    results.push({ id: preset.id, name: preset.name || instrument.name, instrument: instrument.name, family: category.name, program: instrument.program, format: 'webaudiofont', bank: preset.id.split('_').slice(1).join('_') })
    if (results.length >= 400) return results
  }
  return results
}

async function installWebAudioFont(root, preset, progress) {
  const packId = `webaudiofont-${safeId(preset.id)}`
  const directory = path.join(root, 'packs', packId)
  await fs.mkdir(directory, { recursive: true })
  const file = path.join(directory, 'preset.json')
  const url = `https://webaudiofonts.com/presets/${encodeURIComponent(preset.id)}.json`
  const bytes = await download(url, file, (value) => progress?.({ phase: 'download', label: `Downloading ${preset.name}`, ...value }))
  const data = await readJson(file)
  const instrument = { id: 'preset', name: data.instrument || data.name || preset.name, variant: data.name, family: data.category || preset.family || 'Other', format: 'webaudiofont', file: 'preset.json', program: data.program ?? preset.program ?? 0 }
  await writeManifest(directory, { schemaVersion: 1, id: packId, name: `${instrument.name} — ${instrument.variant || preset.bank}`, version: 'current', format: 'webaudiofont', bytes, source: url, installedAt: new Date().toISOString(), instruments: [instrument] })
  return { id: packId, name: instrument.name, bytes, instrumentCount: 1 }
}

function parseOpcodes(text) {
  const output = {}
  for (const match of text.matchAll(/([a-zA-Z0-9_]+)=((?:"[^"]*")|(?:[^\s]+))/g)) output[match[1].toLowerCase()] = match[2].replace(/^"|"$/g, '')
  return output
}

function noteNumber(value, fallback = 60) {
  if (value === undefined) return fallback
  if (/^-?\d+$/.test(value)) return Math.max(0, Math.min(127, Number(value)))
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(value)
  if (!match) return fallback
  const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0)
  return Math.max(0, Math.min(127, (Number(match[3]) + 1) * 12 + semitone))
}

function parseSfz(text) {
  const stripped = text.replace(/\/\/.*$/gm, '')
  const global = {}, group = {}, zones = []
  for (const match of stripped.matchAll(/<(global|group|region)>\s*([^<]*)/gi)) {
    const kind = match[1].toLowerCase(), opcodes = parseOpcodes(match[2])
    if (kind === 'global') Object.assign(global, opcodes)
    if (kind === 'group') { for (const key of Object.keys(group)) delete group[key]; Object.assign(group, opcodes) }
    if (kind === 'region' && opcodes.sample) {
      const merged = { ...global, ...group, ...opcodes }
      const key = noteNumber(merged.key, noteNumber(merged.pitch_keycenter, 60))
      zones.push({ sample: merged.sample.replace(/\\/g, '/'), rootKey: noteNumber(merged.pitch_keycenter, key), loKey: noteNumber(merged.lokey, key), hiKey: noteNumber(merged.hikey, key), loVel: Number(merged.lovel ?? 0), hiVel: Number(merged.hivel ?? 127), tune: Number(merged.tune ?? 0), gainDb: Number(merged.volume ?? 0), loopMode: merged.loop_mode || 'no_loop', loopStart: Number(merged.loop_start ?? 0), loopEnd: Number(merged.loop_end ?? 0), oneShot: merged.loop_mode === 'one_shot' })
    }
  }
  if (!zones.length) throw new Error('The SFZ file does not contain any playable <region> samples.')
  return zones
}

async function uniqueDestination(directory, filename) {
  const parsed = path.parse(filename)
  let target = path.join(directory, `${safeId(parsed.name)}${parsed.ext.toLowerCase()}`)
  let index = 2
  while (true) {
    try { await fs.access(target); target = path.join(directory, `${safeId(parsed.name)}-${index++}${parsed.ext.toLowerCase()}`) } catch { return target }
  }
}

async function importFile(root, sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase()
  const stat = await fs.stat(sourcePath)
  const hash = crypto.createHash('sha256').update(`${sourcePath}:${stat.size}:${stat.mtimeMs}`).digest('hex').slice(0, 12)
  const id = `user-${safeId(path.basename(sourcePath, extension))}-${hash}`
  const directory = path.join(root, 'packs', id)
  await fs.mkdir(directory, { recursive: true })
  let instruments, bytes = stat.size, format
  if (['.sf2', '.sf3', '.dls'].includes(extension)) {
    const target = path.join(directory, path.basename(sourcePath))
    await fs.copyFile(sourcePath, target)
    instruments = await soundFontInstruments(target); format = 'soundfont'
  } else if (extension === '.sfz') {
    const text = await fs.readFile(sourcePath, 'utf8')
    const zones = parseSfz(text), samplesDir = path.join(directory, 'samples')
    await fs.mkdir(samplesDir, { recursive: true })
    for (const zone of zones) {
      const source = path.resolve(path.dirname(sourcePath), zone.sample)
      const target = await uniqueDestination(samplesDir, path.basename(source))
      await fs.copyFile(source, target)
      const sampleStat = await fs.stat(target); bytes += sampleStat.size
      zone.sample = path.relative(directory, target).replace(/\\/g, '/')
    }
    instruments = [{ id: 'instrument', name: path.basename(sourcePath, extension), family: 'User', format: 'sfz', zones }]; format = 'sfz'
  } else if (['.wav', '.ogg', '.mp3', '.flac', '.m4a'].includes(extension)) {
    const target = path.join(directory, path.basename(sourcePath))
    await fs.copyFile(sourcePath, target)
    instruments = [{ id: 'instrument', name: path.basename(sourcePath, extension), family: 'User Samples', format: 'sample', zones: [{ sample: path.basename(target), rootKey: 60, loKey: 0, hiKey: 127, loVel: 0, hiVel: 127, tune: 0, gainDb: 0, loopMode: 'no_loop', loopStart: 0, loopEnd: 0, oneShot: false }] }]; format = 'sample'
  } else throw new Error('Choose an SF2, SF3, DLS, SFZ, WAV, OGG, MP3, FLAC, or M4A instrument file.')
  await writeManifest(directory, { schemaVersion: 1, id, name: path.basename(sourcePath, extension), version: 'user', format, bytes, source: sourcePath, installedAt: new Date().toISOString(), instruments })
  return { id, name: path.basename(sourcePath, extension), bytes, instrumentCount: instruments.length }
}

async function resolveInstrument(root, reference) {
  const split = String(reference).indexOf(':')
  if (split < 1) throw new Error('Invalid instrument reference.')
  const packId = reference.slice(0, split), instrumentId = reference.slice(split + 1)
  const directory = path.join(root, 'packs', safeId(packId))
  const manifest = await readJson(path.join(directory, 'manifest.json'))
  if (manifest.id !== packId) throw new Error('Instrument pack identifier mismatch.')
  const instrument = manifest.instruments.find((candidate) => candidate.id === instrumentId)
  if (!instrument) throw new Error(`Instrument is not installed: ${reference}`)
  if (instrument.format === 'soundfont') {
    const data = await fs.readFile(path.join(directory, instrument.file))
    return { instrument: { ...instrument, id: reference, packId, packName: manifest.name }, data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) }
  }
  if (instrument.format === 'webaudiofont') return { instrument: { ...instrument, id: reference, packId, packName: manifest.name }, preset: await readJson(path.join(directory, instrument.file)) }
  const zones = []
  for (const zone of instrument.zones || []) {
    const target = path.resolve(directory, zone.sample)
    if (!target.startsWith(`${path.resolve(directory)}${path.sep}`) && target !== path.resolve(directory)) throw new Error('Instrument sample path escapes its pack.')
    const data = await fs.readFile(target)
    zones.push({ ...zone, data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), extension: path.extname(target).toLowerCase() })
  }
  return { instrument: { ...instrument, id: reference, packId, packName: manifest.name }, zones }
}

async function removePack(root, packId) {
  const directory = path.join(root, 'packs', safeId(packId))
  const manifest = await readJson(path.join(directory, 'manifest.json'))
  if (manifest.id !== packId) throw new Error('Instrument pack identifier mismatch.')
  await fs.rm(directory, { recursive: true })
  return true
}

module.exports = { libraryRoot, ensureRoot, state, installGeneralUser, webAudioCatalog, installWebAudioFont, importFile, resolveInstrument, removePack, parseSfz }
