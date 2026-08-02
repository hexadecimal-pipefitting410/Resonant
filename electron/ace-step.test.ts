import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const aceStep = require('./ace-step.cjs') as {
  state(root: string): Promise<{ installed: boolean; modelsReady: boolean; running: boolean; bytes: number; root: string }>
}
const temporary: string[] = []

afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))))

describe('ACE-Step optional runtime', () => {
  it('reports an untouched shared directory as optional and not installed', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'resonant-ace-state-'))
    temporary.push(root)
    const state = await aceStep.state(root)
    expect(state).toMatchObject({ root, installed: false, modelsReady: false, running: false, bytes: 0 })
  })
})
