import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBlankProject, serializeProject } from '../src/domain/project'
import { ResonantWorkspace } from './workspace'

const scratch: string[] = []
afterEach(async () => { await Promise.all(scratch.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

async function makeWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), 'resonant-workspace-test-'))
  scratch.push(root)
  return { root, workspace: new ResonantWorkspace(root) }
}

describe('agent workspace safety', () => {
  it('creates, revisions, snapshots, and restores a project', async () => {
    const { root, workspace } = await makeWorkspace()
    const created = await workspace.writeProject('song.resonant', createBlankProject('Agent song'), { label: 'create' })
    const changed = await workspace.mutateProject('song.resonant', created.revision, 'tempo', (project) => ({ ...project, bpm: 96 }))
    expect(changed.project.bpm).toBe(96)
    expect((await workspace.listHistory('song.resonant'))).toHaveLength(1)
    const restored = await workspace.undoLastChange('song.resonant', changed.revision)
    expect(restored.project.bpm).toBe(120)
    expect(JSON.parse(await readFile(path.join(root, 'song.resonant'), 'utf8')).title).toBe('Agent song')
  })

  it('can compact historical serialization without losing undo state', async () => {
    const { workspace } = await makeWorkspace()
    const created = await workspace.writeProject('song.resonant', createBlankProject(' Agent song '), { label: 'create' })
    const changed = await workspace.mutateProject('song.resonant', created.revision, 'tempo', (project) => ({ ...project, bpm: 96 }))
    const compacted = await workspace.transformHistory('song.resonant', (project) => ({ ...project, title: project.title.trim() }))
    expect(compacted.snapshots).toBe(1)
    expect(compacted.changedSnapshots).toBe(1)
    const restored = await workspace.undoLastChange('song.resonant', changed.revision)
    expect(restored.project.bpm).toBe(120)
    expect(restored.project.title).toBe('Agent song')
  })

  it('rejects stale revisions without changing the project', async () => {
    const { workspace } = await makeWorkspace()
    const created = await workspace.writeProject('song.resonant', createBlankProject(), { label: 'create' })
    await expect(workspace.mutateProject('song.resonant', 'stale', 'bad write', (project) => ({ ...project, bpm: 90 }))).rejects.toThrow(/revision changed/i)
    expect((await workspace.readProject('song.resonant')).revision).toBe(created.revision)
  })

  it('serializes concurrent writes so one stale mutation is rejected', async () => {
    const { workspace } = await makeWorkspace()
    const created = await workspace.writeProject('song.resonant', createBlankProject(), { label: 'create' })
    const attempts = await Promise.allSettled([
      workspace.mutateProject('song.resonant', created.revision, 'tempo a', (project) => ({ ...project, bpm: 90 })),
      workspace.mutateProject('song.resonant', created.revision, 'tempo b', (project) => ({ ...project, bpm: 140 })),
    ])
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1)
    expect([90, 140]).toContain((await workspace.readProject('song.resonant')).project.bpm)
  })

  it('rejects traversal and malformed files while keeping bytes intact', async () => {
    const { root, workspace } = await makeWorkspace()
    await expect(workspace.writeProject('..\\escape.resonant', createBlankProject(), { label: 'escape' })).rejects.toThrow(/inside/i)
    const malformed = path.join(root, 'damaged.resonant')
    await writeFile(malformed, '{"schemaVersion":1,"tracks":[]}', 'utf8')
    const before = await readFile(malformed, 'utf8')
    await expect(workspace.readProject('damaged.resonant')).rejects.toThrow(/incomplete|damaged/i)
    expect(await readFile(malformed, 'utf8')).toBe(before)
  })

  it('does not traverse ignored or symbolic-link-like workspace areas', async () => {
    const { root, workspace } = await makeWorkspace()
    await mkdir(path.join(root, 'node_modules'), { recursive: true })
    await writeFile(path.join(root, 'node_modules', 'ignored.resonant'), serializeProject(createBlankProject()), 'utf8')
    await workspace.writeProject('visible.resonant', createBlankProject('Visible'), { label: 'create' })
    expect((await workspace.listProjects()).map((entry) => entry.path)).toEqual(['visible.resonant'])
  })
})
