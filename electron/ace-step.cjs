const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')

const ACE_VERSION = 'v0.1.8'
const SOURCE_URL = `https://codeload.github.com/ACE-Step/ACE-Step-1.5/zip/refs/tags/${ACE_VERSION}`
const UV_URL = 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip'
const API_ORIGIN = 'http://127.0.0.1:8001'
let serverProcess = null
let serverStartedAt = null

function libraryRoot(app) {
  return process.env.RESONANT_ACE_ROOT || path.join(app.getPath('userData'), 'ai-generators', 'ace-step-1.5')
}

function paths(root) {
  return {
    root,
    source: path.join(root, 'runtime'),
    checkpoints: path.join(root, 'models'),
    outputs: path.join(root, 'outputs'),
    downloads: path.join(root, 'downloads'),
    tools: path.join(root, 'tools'),
    uv: path.join(root, 'tools', 'uv.exe'),
    manifest: path.join(root, 'manifest.json'),
  }
}

async function exists(file) {
  try { await fs.access(file); return true } catch { return false }
}

async function directoryBytes(directory) {
  let total = 0
  try {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) total += await directoryBytes(target)
      else if (entry.isFile()) total += (await fs.stat(target)).size
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  return total
}

async function readManifest(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

async function hasModelWeights(directory) {
  try {
    const names = await fs.readdir(directory)
    return names.some((name) => /^(model|pytorch_model|diffusion_pytorch_model).*(\.safetensors|\.bin|\.index\.json)$/i.test(name))
  } catch { return false }
}

async function health() {
  try {
    const response = await fetch(`${API_ORIGIN}/health`, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch { return false }
}

async function state(root) {
  const location = paths(root)
  const manifest = await readManifest(location.manifest)
  const installed = await exists(path.join(location.source, 'pyproject.toml')) && await exists(path.join(location.source, '.venv', 'Scripts', 'python.exe'))
  const modelsReady = await Promise.all(['vae', 'Qwen3-Embedding-0.6B', 'acestep-v15-turbo', 'acestep-5Hz-lm-0.6B'].map((name) => hasModelWeights(path.join(location.checkpoints, name)))).then((items) => items.every(Boolean))
  return {
    root,
    version: manifest?.version || null,
    installed,
    modelsReady,
    running: await health(),
    pid: serverProcess?.pid || null,
    startedAt: serverStartedAt,
    bytes: await directoryBytes(root),
    outputs: await fs.readdir(location.outputs).catch(() => []),
    profile: { dit: 'acestep-v15-turbo', languageModel: 'acestep-5Hz-lm-0.6B', backend: 'pt', cpuOffload: true, batchSize: 1 },
  }
}

async function download(url, target, progress, label) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`${label} download failed (${response.status}).`)
  const total = Number(response.headers.get('content-length')) || 0
  const temp = `${target}.download-${process.pid}`
  const handle = await fs.open(temp, 'w')
  let received = 0
  try {
    for await (const chunk of response.body) {
      const buffer = Buffer.from(chunk)
      await handle.write(buffer)
      received += buffer.length
      progress?.({ phase: 'download', label, received, total })
    }
  } finally { await handle.close() }
  await fs.rename(temp, target)
  return received
}

function run(executable, args, options = {}, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, ...options })
    let stdout = '', stderr = '', pending = ''
    const receive = (chunk, error = false) => {
      const value = chunk.toString()
      if (error) stderr += value; else stdout += value
      pending += value
      const lines = pending.split(/\r?\n|\r/); pending = lines.pop() || ''
      for (const line of lines) if (line.trim()) onLine?.(line.trim())
    }
    child.stdout?.on('data', (chunk) => receive(chunk))
    child.stderr?.on('data', (chunk) => receive(chunk, true))
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error((stderr || stdout || `${path.basename(executable)} exited with ${code}`).trim().slice(-4000))))
  })
}

async function expandArchive(archive, destination) {
  await fs.mkdir(destination, { recursive: true })
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:RESONANT_ARCHIVE -DestinationPath $env:RESONANT_DESTINATION -Force'], { env: { ...process.env, RESONANT_ARCHIVE: archive, RESONANT_DESTINATION: destination } })
}

async function ensureCheckpointLink(location) {
  const link = path.join(location.source, 'checkpoints')
  try {
    const info = await fs.lstat(link)
    if (info.isSymbolicLink()) {
      const target = path.resolve(location.source, await fs.readlink(link))
      if (target === path.resolve(location.checkpoints)) return
      throw new Error('The ACE-Step checkpoint link points to an unexpected location.')
    }
    const entries = await fs.readdir(link)
    if (entries.length) throw new Error('ACE-Step created a separate checkpoint folder. Remove it before repairing the optional installation.')
    await fs.rmdir(link)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  await fs.symlink(location.checkpoints, link, process.platform === 'win32' ? 'junction' : 'dir')
}

async function install(root, progress) {
  const location = paths(root)
  await Promise.all(Object.values(location).filter((value) => typeof value === 'string' && !path.extname(value)).map((directory) => fs.mkdir(directory, { recursive: true })))
  await fs.mkdir(location.downloads, { recursive: true })
  await fs.mkdir(location.tools, { recursive: true })
  await fs.mkdir(location.outputs, { recursive: true })
  await fs.mkdir(location.checkpoints, { recursive: true })

  if (!await exists(location.uv)) {
    progress?.({ phase: 'setup', label: 'Downloading the private Python runtime manager', received: 0, total: 0 })
    const archive = path.join(location.downloads, 'uv.zip')
    if (!await exists(archive)) await download(UV_URL, archive, progress, 'Downloading runtime manager')
    const extracted = path.join(location.downloads, 'uv-extracted')
    await fs.rm(extracted, { recursive: true, force: true })
    await expandArchive(archive, extracted)
    const uvCandidate = (await fs.readdir(extracted, { recursive: true })).find((item) => path.basename(item).toLowerCase() === 'uv.exe')
    if (!uvCandidate) throw new Error('The downloaded runtime manager did not contain uv.exe.')
    await fs.copyFile(path.join(extracted, uvCandidate), location.uv)
  }

  if (!await exists(path.join(location.source, 'pyproject.toml'))) {
    progress?.({ phase: 'setup', label: 'Downloading ACE-Step 1.5', received: 0, total: 0 })
    const archive = path.join(location.downloads, `ace-step-${ACE_VERSION}.zip`)
    if (!await exists(archive)) await download(SOURCE_URL, archive, progress, 'Downloading ACE-Step 1.5')
    const staging = path.join(location.downloads, `source-${Date.now()}`)
    await expandArchive(archive, staging)
    const topLevel = (await fs.readdir(staging, { withFileTypes: true })).find((entry) => entry.isDirectory())
    if (!topLevel) throw new Error('The ACE-Step archive did not contain a source directory.')
    await fs.rm(location.source, { recursive: true, force: true })
    await fs.rename(path.join(staging, topLevel.name), location.source)
    await fs.rm(staging, { recursive: true, force: true })
  }

  await ensureCheckpointLink(location)

  const environment = [
    'ACESTEP_INIT_LLM=true',
    'ACESTEP_CONFIG_PATH=acestep-v15-turbo',
    'ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-0.6B',
    'ACESTEP_LM_BACKEND=pt',
    'ACESTEP_OFFLOAD_TO_CPU=true',
    'ACESTEP_LM_OFFLOAD_TO_CPU=true',
    `ACESTEP_CHECKPOINTS_DIR=${location.checkpoints.replace(/\\/g, '/')}`,
    `ACESTEP_TMPDIR=${path.join(root, 'cache', 'tmp').replace(/\\/g, '/')}`,
    `HF_HOME=${path.join(root, 'cache', 'huggingface').replace(/\\/g, '/')}`,
    'ACESTEP_API_HOST=127.0.0.1',
    'ACESTEP_API_PORT=8001',
    'ACESTEP_QUEUE_WORKERS=1',
  ].join('\n')
  await fs.writeFile(path.join(location.source, '.env'), `${environment}\n`)

  const current = await state(root)
  if (current.installed && current.modelsReady) {
    await fs.writeFile(location.manifest, `${JSON.stringify({ version: ACE_VERSION, installedAt: new Date().toISOString(), source: SOURCE_URL }, null, 2)}\n`)
    progress?.({ phase: 'ready', label: 'ACE-Step 1.5 is ready', received: 1, total: 1 })
    return state(root)
  }

  progress?.({ phase: 'setup', label: 'Installing the isolated ACE-Step runtime', received: 0, total: 0 })
  await run(location.uv, ['sync', '--no-dev'], { cwd: location.source, env: { ...aceEnvironment(root), UV_PROJECT_ENVIRONMENT: path.join(location.source, '.venv') } }, (line) => progress?.({ phase: 'setup', label: line.slice(0, 120), received: 0, total: 0 }))
  progress?.({ phase: 'model', label: 'Downloading the ACE-Step core music model', received: 0, total: 0 })
  await run(location.uv, ['run', 'acestep-download'], { cwd: location.source, env: aceEnvironment(root) }, (line) => progress?.({ phase: 'model', label: line.slice(0, 120), received: 0, total: 0 }))
  progress?.({ phase: 'model', label: 'Downloading the lightweight 0.6B music planner', received: 0, total: 0 })
  await run(location.uv, ['run', 'acestep-download', '--model', 'acestep-5Hz-lm-0.6B', '--skip-main'], { cwd: location.source, env: aceEnvironment(root) }, (line) => progress?.({ phase: 'model', label: line.slice(0, 120), received: 0, total: 0 }))
  await fs.writeFile(location.manifest, `${JSON.stringify({ version: ACE_VERSION, installedAt: new Date().toISOString(), source: SOURCE_URL }, null, 2)}\n`)
  progress?.({ phase: 'ready', label: 'ACE-Step 1.5 is ready', received: 1, total: 1 })
  return state(root)
}

function aceEnvironment(root) {
  const location = paths(root)
  return {
    ...process.env,
    ACESTEP_PROJECT_ROOT: location.source,
    ACESTEP_CHECKPOINTS_DIR: location.checkpoints,
    ACESTEP_INIT_LLM: 'true',
    ACESTEP_CONFIG_PATH: 'acestep-v15-turbo',
    ACESTEP_LM_MODEL_PATH: 'acestep-5Hz-lm-0.6B',
    ACESTEP_LM_BACKEND: 'pt',
    ACESTEP_OFFLOAD_TO_CPU: 'true',
    ACESTEP_LM_OFFLOAD_TO_CPU: 'true',
    ACESTEP_API_HOST: '127.0.0.1',
    ACESTEP_API_PORT: '8001',
    ACESTEP_QUEUE_WORKERS: '1',
    ACESTEP_TMPDIR: path.join(root, 'cache', 'tmp'),
    HF_HOME: path.join(root, 'cache', 'huggingface'),
    HF_HUB_DISABLE_XET: '1',
    HF_HUB_DOWNLOAD_TIMEOUT: '120',
    TRITON_CACHE_DIR: path.join(root, 'cache', 'triton'),
    TORCHINDUCTOR_CACHE_DIR: path.join(root, 'cache', 'torchinductor'),
    UV_CACHE_DIR: path.join(root, 'cache', 'uv'),
  }
}

async function start(root, progress) {
  if (await health()) return state(root)
  const location = paths(root)
  if (!await exists(path.join(location.source, 'pyproject.toml'))) throw new Error('Install ACE-Step before starting it.')
  if (serverProcess && serverProcess.exitCode === null) return state(root)
  progress?.({ phase: 'starting', label: 'Loading ACE-Step into GPU memory', received: 0, total: 0 })
  const apiExecutable = path.join(location.source, '.venv', 'Scripts', process.platform === 'win32' ? 'acestep-api.exe' : 'acestep-api')
  if (!await exists(apiExecutable)) throw new Error('The ACE-Step API executable is missing. Run the optional installation again.')
  serverProcess = spawn(apiExecutable, [], { cwd: location.source, env: aceEnvironment(root), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  serverStartedAt = new Date().toISOString()
  const forward = (chunk) => {
    const line = chunk.toString().trim().split(/\r?\n/).at(-1)
    if (line) progress?.({ phase: 'starting', label: line.slice(0, 140), received: 0, total: 0 })
  }
  serverProcess.stdout.on('data', forward); serverProcess.stderr.on('data', forward)
  serverProcess.once('exit', () => { serverProcess = null; serverStartedAt = null })
  const deadline = Date.now() + 10 * 60_000
  while (Date.now() < deadline) {
    if (await health()) { progress?.({ phase: 'ready', label: 'ACE-Step service is ready', received: 1, total: 1 }); return state(root) }
    if (!serverProcess || serverProcess.exitCode !== null) throw new Error('ACE-Step stopped before it became ready.')
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new Error('ACE-Step took too long to start.')
}

async function stop() {
  if (!serverProcess || serverProcess.exitCode !== null) { serverProcess = null; serverStartedAt = null; return true }
  const pid = serverProcess.pid
  if (process.platform === 'win32') await run('taskkill.exe', ['/pid', String(pid), '/T', '/F']).catch(() => serverProcess?.kill())
  else serverProcess.kill('SIGTERM')
  serverProcess = null; serverStartedAt = null
  return true
}

function safeName(value) {
  return String(value || 'ACE-Step creation').replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'ACE-Step creation'
}

async function apiJson(route, options = {}) {
  const { timeout = 30_000, ...fetchOptions } = options
  const response = await fetch(`${API_ORIGIN}${route}`, { ...fetchOptions, signal: AbortSignal.timeout(timeout) })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.code && data.code !== 200) throw new Error(data?.error || data?.detail || `ACE-Step request failed (${response.status}).`)
  return data?.data ?? data
}

async function generate(root, request, progress) {
  await start(root, progress)
  const duration = Math.max(10, Math.min(180, Number(request.duration) || 30))
  const prompt = String(request.prompt || '').trim().slice(0, 2000)
  if (!prompt) throw new Error('Describe the music you want ACE-Step to create.')
  const task = await apiJson('/release_task', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt, lyrics: request.instrumental === false ? String(request.lyrics || '').slice(0, 6000) : '[Instrumental]',
      thinking: true, model: 'acestep-v15-turbo', lm_model_path: 'acestep-5Hz-lm-0.6B', lm_backend: 'pt',
      audio_duration: duration, bpm: request.bpm ? Math.max(30, Math.min(300, Number(request.bpm))) : undefined,
      key_scale: String(request.keyScale || ''), time_signature: '4', vocal_language: String(request.language || 'en'),
      inference_steps: 8, batch_size: 1, audio_format: 'wav', use_random_seed: request.seed == null,
      seed: request.seed == null ? -1 : Math.trunc(Number(request.seed)), use_tiled_decode: true,
    }), timeout: 10 * 60_000,
  })
  const taskId = task?.task_id
  if (!taskId) throw new Error(`ACE-Step did not return a generation task ID${task == null ? ' (empty response)' : ''}.`)
  progress?.({ phase: 'generate', label: 'Composing and rendering your music', received: 0, total: 100 })
  const deadline = Date.now() + 30 * 60_000
  let attempt = 0
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const results = await apiJson('/query_result', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task_id_list: [taskId] }) })
    const item = Array.isArray(results) ? results[0] : null
    if (item?.status === 2) throw new Error(item.error || 'ACE-Step generation failed.')
    if (item?.status === 1) {
      const generated = JSON.parse(item.result || '[]')
      const first = generated[0]
      if (!first?.file) throw new Error('ACE-Step completed without an audio file.')
      const response = await fetch(first.file.startsWith('http') ? first.file : `${API_ORIGIN}${first.file}`)
      if (!response.ok) throw new Error(`Generated audio download failed (${response.status}).`)
      const data = Buffer.from(await response.arrayBuffer())
      const location = paths(root); await fs.mkdir(location.outputs, { recursive: true })
      const filename = `${safeName(request.title || prompt)}-${Date.now()}.wav`
      const outputPath = path.join(location.outputs, filename)
      await fs.writeFile(outputPath, data)
      progress?.({ phase: 'ready', label: 'Your ACE-Step music is ready', received: 100, total: 100 })
      return { path: outputPath, name: path.basename(filename, '.wav'), data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), taskId, metadata: first.metas || {}, seed: first.seed_value || null }
    }
    attempt += 1
    progress?.({ phase: 'generate', label: 'Composing and rendering your music', received: Math.min(92, 8 + attempt), total: 100 })
  }
  throw new Error('ACE-Step generation timed out.')
}

async function remove(root) {
  await stop()
  const resolved = path.resolve(root)
  if (!resolved.toLowerCase().endsWith(path.join('ai-generators', 'ace-step-1.5').toLowerCase()) && !process.env.RESONANT_ACE_ROOT) throw new Error('Refusing to remove an unexpected ACE-Step directory.')
  await fs.rm(resolved, { recursive: true, force: true })
  return true
}

module.exports = { ACE_VERSION, API_ORIGIN, libraryRoot, state, install, start, stop, generate, remove }
