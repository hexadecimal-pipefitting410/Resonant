import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const repository = path.resolve(import.meta.dirname, '..')
const projectRoot = path.resolve(process.argv[2] || process.cwd())
const projectPath = process.argv[3]
if (!projectPath) throw new Error('Usage: node scripts/migrate-project-audio.mjs <project-root> <project.resonant> [report.json] [vocal.wav] [skip|tiny.en|base.en]')
const reportPath = path.resolve(process.argv[4] || path.join(projectRoot, `${path.basename(projectPath, '.resonant')} - Audio Migration Report.json`))
const vocalWav = process.argv[5]
const localModel = process.argv[6] || 'skip'
const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(repository, 'mcp-dist', 'server.mjs'), '--root', projectRoot], stderr: 'pipe' })
const client = new Client({ name: 'resonant-audio-migration', version: '0.4.0' })

function parse(response) {
  const block = response.content?.find((candidate) => candidate.type === 'text')
  if (!block || block.type !== 'text') throw new Error('MCP result did not contain JSON text.')
  let data
  try { data = JSON.parse(block.text) } catch { if (response.isError) throw new Error(block.text); throw new Error(`MCP returned non-JSON text: ${block.text}`) }
  if (response.isError) throw new Error(data.error || block.text)
  return data
}

async function call(name, args = {}, timeout = 120_000) {
  return parse(await client.callTool({ name, arguments: args }, undefined, { timeout, maxTotalTimeout: timeout }))
}

try {
  await client.connect(transport)
  const capabilities = await call('get_capabilities')
  const before = (await call('inspect_project', { path: projectPath })).project
  const migration = await call('externalize_audio_assets', { path: projectPath, expectedRevision: before.revision })
  const after = (await call('inspect_project', { path: projectPath })).project
  const validation = await call('validate_project', { path: projectPath })
  const mix = await call('analyze_mix', { path: projectPath, expectedRevision: after.revision, durationBeats: after.durationBeats }, 10 * 60_000)
  const songwriting = after.songwriting?.lyrics ? await call('analyze_lyrics', after.songwriting) : null
  const vocal = vocalWav && after.songwriting?.lyrics
    ? await call('analyze_vocal_lyrics', { wavPath: vocalWav, lyrics: after.songwriting.lyrics, localModel }, 30 * 60_000)
    : null
  const report = {
    ok: true,
    projectRoot,
    projectPath,
    before: { revision: before.revision, audioClips: before.clips.filter((clip) => clip.type === 'audio').map((clip) => ({ id: clip.id, name: clip.name, storage: clip.asset ? 'shared' : 'embedded', asset: clip.asset || null })) },
    migration,
    after: { revision: after.revision, audioClips: after.clips.filter((clip) => clip.type === 'audio').map((clip) => ({ id: clip.id, name: clip.name, storage: clip.asset ? 'shared' : 'embedded', asset: clip.asset || null })) },
    validation,
    mix: mix.analysis,
    songwriting: songwriting?.analysis || null,
    vocal,
    capabilities: { audioStorage: capabilities.projectFormat.audioStorage, aiGeneration: capabilities.aiGeneration },
  }
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  process.stdout.write(`${JSON.stringify({ ...report, reportPath }, null, 2)}\n`)
} finally {
  await client.close().catch(() => undefined)
}
