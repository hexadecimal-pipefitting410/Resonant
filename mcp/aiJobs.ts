import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { aceStepRoot, collectAiMusic, queryAiMusic, startAiMusic, type AiMusicRequest } from './aceStep'

interface DurableAiJob {
  schemaVersion: 1
  id: string
  aceTaskId: string
  requestHash: string
  idempotencyHash?: string
  createdAt: string
  abandonedAt?: string
  collectedAt?: string
  collectedOutput?: string
}

function directory() { return path.join(aceStepRoot(), 'mcp-jobs') }
function jobPath(id: string) { return path.join(directory(), `${id}.json`) }
function keyPath(hash: string) { return path.join(directory(), `key-${hash}.json`) }
function hash(value: string) { return createHash('sha256').update(value).digest('hex') }

async function readJson<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await readFile(file, 'utf8')) as T } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
}

async function atomicJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  await rename(temporary, file)
}

export async function startDurableAiJob(request: AiMusicRequest, idempotencyKey?: string) {
  const requestHash = hash(JSON.stringify(request))
  const idempotencyHash = idempotencyKey ? hash(idempotencyKey) : undefined
  let replacedJobId: string | undefined
  if (idempotencyHash) {
    const existingId = await readJson<{ jobId: string; requestHash: string }>(keyPath(idempotencyHash))
    if (existingId) {
      if (existingId.requestHash !== requestHash) throw new Error('This AI-generation idempotency key was already used with a different request.')
      const existing = await readJson<DurableAiJob>(jobPath(existingId.jobId))
      if (existing && !existing.abandonedAt) return { job: existing, reused: true }
      replacedJobId = existing?.id
    }
  }
  const submitted = await startAiMusic(request)
  const job: DurableAiJob = { schemaVersion: 1, id: `ai-${randomUUID()}`, aceTaskId: submitted.taskId, requestHash, idempotencyHash, createdAt: submitted.submittedAt }
  await atomicJson(jobPath(job.id), job)
  if (idempotencyHash) await atomicJson(keyPath(idempotencyHash), { jobId: job.id, requestHash })
  return { job, reused: false, replacedJobId }
}

async function requireJob(id: string) {
  if (!/^ai-[a-f0-9-]{36}$/i.test(id)) throw new Error('Invalid AI-generation job ID.')
  const job = await readJson<DurableAiJob>(jobPath(id))
  if (!job) throw new Error(`AI-generation job not found: ${id}.`)
  return job
}

export async function getDurableAiJob(id: string) {
  const job = await requireJob(id)
  if (job.abandonedAt) return { jobId: job.id, status: 'abandoned' as const, progress: 0, stage: 'abandoned', message: 'Resonant will not collect this result. ACE-Step may still finish an active GPU kernel because its API has no per-task interrupt.', createdAt: job.createdAt, abandonedAt: job.abandonedAt }
  const state = await queryAiMusic(job.aceTaskId)
  return { jobId: job.id, ...state, createdAt: job.createdAt, collectedAt: job.collectedAt, collectedOutput: job.collectedOutput }
}

export async function collectDurableAiJob(id: string) {
  const job = await requireJob(id)
  if (job.abandonedAt) throw new Error('This AI-generation job was abandoned and cannot be collected.')
  return { job, generated: await collectAiMusic(job.aceTaskId) }
}

export async function markDurableAiJobCollected(id: string, output: string) {
  const job = await requireJob(id)
  const changed = { ...job, collectedAt: new Date().toISOString(), collectedOutput: output }
  await atomicJson(jobPath(id), changed)
  return changed
}

export async function abandonDurableAiJob(id: string) {
  const job = await requireJob(id)
  if (job.collectedAt) throw new Error('A collected AI-generation job cannot be abandoned.')
  const changed = { ...job, abandonedAt: job.abandonedAt || new Date().toISOString() }
  await atomicJson(jobPath(id), changed)
  return { jobId: id, status: 'abandoned' as const, abandonedAt: changed.abandonedAt, engineInterrupted: false, message: 'The result will not be collected. ACE-Step may finish an already-running GPU kernel; stopping the shared engine would also interrupt unrelated work.' }
}
