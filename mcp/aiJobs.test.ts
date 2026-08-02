import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ root: '', start: vi.fn(), query: vi.fn(), collect: vi.fn() }))
vi.mock('./aceStep', () => ({
  aceStepRoot: () => mocks.root,
  startAiMusic: mocks.start,
  queryAiMusic: mocks.query,
  collectAiMusic: mocks.collect,
}))

import { abandonDurableAiJob, getDurableAiJob, startDurableAiJob } from './aiJobs'

const temporary: string[] = []
beforeEach(async () => {
  mocks.root = await mkdtemp(path.join(tmpdir(), 'resonant-ai-jobs-')); temporary.push(mocks.root)
  mocks.start.mockReset().mockResolvedValue({ taskId: 'ace-task-1', submittedAt: '2026-08-01T00:00:00.000Z' })
  mocks.query.mockReset().mockResolvedValue({ taskId: 'ace-task-1', status: 'running', progress: 0.42, stage: 'generating', message: 'Rendering' })
})
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))))

describe('durable asynchronous AI jobs', () => {
  it('reuses an idempotent request across calls and persists observable progress', async () => {
    const request = { prompt: 'Original anthemic pop', instrumental: true, duration: 20 }
    const first = await startDurableAiJob(request, 'stable-showcase-key')
    const repeated = await startDurableAiJob(request, 'stable-showcase-key')
    expect(repeated.reused).toBe(true)
    expect(repeated.job.id).toBe(first.job.id)
    expect(mocks.start).toHaveBeenCalledTimes(1)
    await expect(startDurableAiJob({ ...request, duration: 30 }, 'stable-showcase-key')).rejects.toThrow(/different request/i)
    await expect(getDurableAiJob(first.job.id)).resolves.toMatchObject({ status: 'running', progress: 0.42 })
    await expect(abandonDurableAiJob(first.job.id)).resolves.toMatchObject({ status: 'abandoned', engineInterrupted: false })
    await expect(getDurableAiJob(first.job.id)).resolves.toMatchObject({ status: 'abandoned' })
    const restarted = await startDurableAiJob(request, 'stable-showcase-key')
    expect(restarted.reused).toBe(false)
    expect(restarted.replacedJobId).toBe(first.job.id)
    expect(restarted.job.id).not.toBe(first.job.id)
    expect(mocks.start).toHaveBeenCalledTimes(2)
  })
})
