import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), unref: vi.fn(), once: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))

import { generationPayload, launchAceStepService } from './aceStep'

beforeEach(() => {
  mocks.spawn.mockReset().mockReturnValue({ unref: mocks.unref, once: mocks.once, exitCode: null })
  mocks.unref.mockReset()
  mocks.once.mockReset()
})

describe('ACE-Step MCP generation boundary', () => {
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
