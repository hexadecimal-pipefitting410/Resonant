import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), unref: vi.fn(), once: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))

import { aceStepState, generationPayload, launchAceStepService } from './aceStep'

beforeEach(() => {
  mocks.spawn.mockReset().mockReturnValue({ unref: mocks.unref, once: mocks.once, exitCode: null })
  mocks.unref.mockReset()
  mocks.once.mockReset()
})

describe('ACE-Step MCP generation boundary', () => {
  it('does not report an unrelated healthy service for an uninstalled root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'resonant-mcp-ace-state-'))
    const previous = process.env.RESONANT_ACE_ROOT
    process.env.RESONANT_ACE_ROOT = root
    try {
      await expect(aceStepState()).resolves.toMatchObject({ root, installed: false, modelsReady: false, running: false })
    } finally {
      if (previous === undefined) delete process.env.RESONANT_ACE_ROOT
      else process.env.RESONANT_ACE_ROOT = previous
      await rm(root, { recursive: true, force: true })
    }
  })

  it('launches the shared engine detached from the short-lived MCP process', () => {
    const child = launchAceStepService('acestep-api.exe', 'C:\\ace-step', { TEST: '1' })
    expect(mocks.spawn).toHaveBeenCalledWith('acestep-api.exe', [], expect.objectContaining({
      cwd: 'C:\\ace-step', detached: true, windowsHide: true, stdio: 'ignore',
    }))
    expect(mocks.unref).toHaveBeenCalledOnce()
    expect(child).toBeTruthy()
  })

  it('normalizes native control tags in the payload while retaining the Korean lyric', () => {
    const payload = generationPayload({
      prompt: 'Original Korean pop', language: 'ko-KR', instrumental: false,
      lyrics: '[후렴]\n잔상, 잔상, 날 붙잡지 마\n\n[마지막 후렴]\nI finally see me',
    })
    expect(payload.lyrics).toBe('[Chorus]\n잔상, 잔상, 날 붙잡지 마\n\n[Final Chorus]\nI finally see me')
  })
})
