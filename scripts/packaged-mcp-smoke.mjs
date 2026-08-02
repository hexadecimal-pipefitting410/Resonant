import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const root = path.resolve(import.meta.dirname, '..')
const scratch = await mkdtemp(path.join(tmpdir(), 'resonant-packaged-mcp-'))
const output = path.join(scratch, 'build')
const projectRoot = path.join(scratch, 'projects')
const cli = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js')

function parse(response) {
  const block = response.content?.find((candidate) => candidate.type === 'text')
  if (!block || block.type !== 'text') throw new Error('Packaged MCP returned no JSON text.')
  const data = JSON.parse(block.text)
  if (response.isError) throw new Error(data.error || block.text)
  return data
}

try {
  await mkdir(projectRoot, { recursive: true })
  const built = spawnSync(process.execPath, [cli, '--dir', '--win', `--config.directories.output=${output}`], { cwd: root, stdio: 'inherit', shell: false })
  if (built.status !== 0) throw new Error(`Packaged application build failed with exit code ${built.status}.`)
  const unpackedName = (await readdir(output)).find((name) => name.endsWith('win-unpacked'))
  if (!unpackedName) throw new Error('electron-builder produced no unpacked Windows application.')
  const unpacked = path.join(output, unpackedName)
  const executable = path.join(unpacked, 'Resonant.exe')
  const archive = path.join(unpacked, 'resources', 'app.asar')
  const server = path.join(archive, 'mcp-dist', 'server.mjs')
  const launcher = path.join(unpacked, 'Resonant-MCP.cmd')
  const license = path.join(unpacked, 'LICENSE.txt')
  await Promise.all([access(executable), access(archive), access(launcher), access(license)])

  const transport = new StdioClientTransport({
    command: executable,
    args: [server, '--root', projectRoot],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', RESONANT_INSTRUMENT_ROOT: path.join(scratch, 'instruments'), RESONANT_ACE_ROOT: path.join(scratch, 'ace'), RESONANT_AUDIO_ASSET_ROOT: path.join(scratch, 'audio-assets') },
    stderr: 'pipe',
  })
  const client = new Client({ name: 'resonant-packaged-mcp-smoke', version: '0.4.0' })
  try {
    await client.connect(transport)
    const tools = await client.listTools()
    const capabilities = parse(await client.callTool({ name: 'get_capabilities', arguments: {} }))
    if (tools.tools.length < 29 || capabilities.aiGeneration?.preferredWorkflow?.[0] !== 'start_ai_generation') throw new Error('The packaged MCP server exposed an incomplete capability set.')
    const report = { ok: true, executableBytes: (await stat(executable)).size, toolCount: tools.tools.length, launcher: path.basename(launcher), license: path.basename(license), server: 'resources/app.asar/mcp-dist/server.mjs' }
    const evidence = path.join(root, '.agent', 'evidence', 'packaged-mcp-smoke.json')
    await mkdir(path.dirname(evidence), { recursive: true })
    await writeFile(evidence, `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`${JSON.stringify(report)}\n`)
  } finally { await client.close().catch(() => undefined) }
} finally {
  const resolved = path.resolve(scratch)
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('resonant-packaged-mcp-')) throw new Error('Refusing to remove an unexpected packaged-smoke path.')
  await rm(resolved, { recursive: true, force: true })
}
