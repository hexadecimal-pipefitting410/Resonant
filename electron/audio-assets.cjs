const { createHash, randomUUID } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

function libraryRoot(app) { return process.env.RESONANT_AUDIO_ASSET_ROOT || path.join(app.getPath('userData'), 'audio-assets') }

function encode(channels, sampleRate) {
  if (!Array.isArray(channels) || channels.length < 1 || channels.length > 2) throw new Error('Shared audio requires one or two channels.')
  const arrays = channels.map((value) => new Float32Array(value))
  const frames = arrays[0].length
  if (!frames || arrays.some((array) => array.length !== frames)) throw new Error('Shared audio channels are invalid.')
  const output = Buffer.allocUnsafe(44 + frames * arrays.length * 2)
  output.write('RIFF', 0); output.writeUInt32LE(output.length - 8, 4); output.write('WAVE', 8); output.write('fmt ', 12); output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(arrays.length, 22); output.writeUInt32LE(sampleRate, 24); output.writeUInt32LE(sampleRate * arrays.length * 2, 28); output.writeUInt16LE(arrays.length * 2, 32); output.writeUInt16LE(16, 34); output.write('data', 36); output.writeUInt32LE(frames * arrays.length * 2, 40)
  let offset = 44
  for (let frame = 0; frame < frames; frame++) for (const array of arrays) { const sample = Math.max(-1, Math.min(1, Number.isFinite(array[frame]) ? array[frame] : 0)); output.writeInt16LE(sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), offset); offset += 2 }
  return output
}

async function store(root, request) {
  const sampleRate = Number(request?.sampleRate)
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('Shared audio sample rate is invalid.')
  const wav = encode(request.channels, sampleRate), id = createHash('sha256').update(wav).digest('hex'), target = path.join(root, `${id}.wav`)
  await fs.mkdir(root, { recursive: true })
  try { await fs.access(target) } catch { const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`; await fs.writeFile(temporary, wav, { flag: 'wx' }); await fs.rename(temporary, target) }
  return { id, sha256: id, bytes: wav.length, format: 'wav-pcm16' }
}

async function resolve(root, id) {
  if (!/^[a-f0-9]{64}$/i.test(id)) throw new Error('Invalid shared audio asset ID.')
  const data = await fs.readFile(path.join(root, `${id}.wav`))
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}

module.exports = { libraryRoot, store, resolve }
