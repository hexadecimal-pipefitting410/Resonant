import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseProject, serializeProject, touch, validateProject } from '../src/domain/project'
import type { Project } from '../src/domain/types'

const MAX_PROJECT_BYTES = 250_000_000
const HISTORY_LIMIT = 20
const HISTORY_MAX_BYTES = 500_000_000
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', 'release', 'mcp-dist', '.git', '.agent'])

export interface LoadedProject {
  path: string
  relativePath: string
  project: Project
  revision: string
  bytes: number
}

export interface HistoryEntry {
  id: string
  createdAt: string
  revision: string
  title: string
  bytes: number
}

export class RevisionConflictError extends Error {
  constructor(expected: string, actual: string) {
    super(`Project revision changed. Expected ${expected}, current revision is ${actual}. Inspect the project and retry deliberately.`)
    this.name = 'RevisionConflictError'
  }
}

function hashText(text: string) {
  return createHash('sha256').update(text).digest('hex')
}

function isMissing(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

export class ResonantWorkspace {
  readonly root: string
  private readonly writeQueues = new Map<string, Promise<void>>()

  constructor(root = process.env.RESONANT_PROJECT_ROOT || process.cwd()) {
    this.root = path.resolve(root)
  }

  private isContained(candidate: string) {
    const relative = path.relative(this.root, candidate)
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  }

  private assertContained(candidate: string) {
    if (!this.isContained(candidate)) throw new Error('Path must remain inside the configured Resonant project root.')
  }

  private async resolveFile(input: string, extension: '.resonant' | '.wav', mustExist: boolean) {
    if (!input || input.includes('\0')) throw new Error('A non-empty file path is required.')
    const candidate = path.resolve(this.root, input)
    this.assertContained(candidate)
    if (path.extname(candidate).toLowerCase() !== extension) throw new Error(`Expected a ${extension} file.`)
    const actualRoot = await realpath(this.root)
    const actualParent = await realpath(path.dirname(candidate)).catch((error: unknown) => {
      if (isMissing(error)) throw new Error('The destination directory does not exist.')
      throw error
    })
    const relativeParent = path.relative(actualRoot, actualParent)
    if (relativeParent.startsWith(`..${path.sep}`) || relativeParent === '..' || path.isAbsolute(relativeParent)) throw new Error('A symbolic link escapes the Resonant project root.')
    if (mustExist) {
      const actualFile = await realpath(candidate).catch((error: unknown) => {
        if (isMissing(error)) throw new Error(`File not found: ${this.relative(candidate)}`)
        throw error
      })
      const relativeFile = path.relative(actualRoot, actualFile)
      if (relativeFile.startsWith(`..${path.sep}`) || relativeFile === '..' || path.isAbsolute(relativeFile)) throw new Error('A symbolic link escapes the Resonant project root.')
    }
    return candidate
  }

  private relative(filePath: string) {
    return path.relative(this.root, filePath).split(path.sep).join('/')
  }

  async projectPath(input: string, mustExist = true) {
    return this.resolveFile(input, '.resonant', mustExist)
  }

  async wavPath(input: string, mustExist = true) {
    return this.resolveFile(input, '.wav', mustExist)
  }

  async readProject(input: string): Promise<LoadedProject> {
    const filePath = await this.projectPath(input, true)
    const info = await stat(filePath)
    if (info.size > MAX_PROJECT_BYTES) throw new Error('This project exceeds the 250 MB safety limit.')
    const text = await readFile(filePath, 'utf8')
    const project = parseProject(text)
    return { path: filePath, relativePath: this.relative(filePath), project, revision: hashText(text), bytes: Buffer.byteLength(text) }
  }

  private historyDirectory(filePath: string) {
    const key = Buffer.from(this.relative(filePath)).toString('base64url')
    return path.join(this.root, '.resonant-history', key)
  }

  private async snapshot(filePath: string, text: string, label: string) {
    const directory = this.historyDirectory(filePath)
    await mkdir(directory, { recursive: true })
    const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
    const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'change'
    const revision = hashText(text)
    const name = `${timestamp}--${safeLabel}--${revision.slice(0, 12)}--${randomUUID().slice(0, 8)}.resonant`
    await writeFile(path.join(directory, name), text, { encoding: 'utf8', flag: 'wx' })
    const entries = (await readdir(directory)).filter((entry) => entry.endsWith('.resonant')).sort().reverse()
    let retainedBytes = 0
    for (let index = 0; index < entries.length; index++) {
      const entryPath = path.join(directory, entries[index])
      const entryBytes = (await stat(entryPath)).size
      retainedBytes += entryBytes
      if (index >= HISTORY_LIMIT || retainedBytes > HISTORY_MAX_BYTES) await unlink(entryPath)
    }
  }

  private async atomicWrite(filePath: string, data: string | Uint8Array) {
    const temporary = `${filePath}.mcp-saving-${process.pid}-${randomUUID()}`
    let pending = true
    try {
      await writeFile(temporary, data, typeof data === 'string' ? { encoding: 'utf8', flag: 'wx' } : { flag: 'wx' })
      await rename(temporary, filePath)
      pending = false
    } finally {
      if (pending) await unlink(temporary).catch(() => undefined)
    }
  }

  private async withWriteLock<T>(filePath: string, action: () => Promise<T>): Promise<T> {
    const previous = this.writeQueues.get(filePath) ?? Promise.resolve()
    let release: () => void = () => undefined
    const current = new Promise<void>((resolve) => { release = resolve })
    this.writeQueues.set(filePath, current)
    await previous
    try { return await action() } finally {
      release()
      if (this.writeQueues.get(filePath) === current) this.writeQueues.delete(filePath)
    }
  }

  async writeWav(input: string, data: Uint8Array, overwrite = false) {
    const filePath = await this.wavPath(input, false)
    if (data.byteLength > 250_000_000) throw new Error('The WAV output exceeds the 250 MB safety limit.')
    if (!overwrite) {
      try { await stat(filePath); throw new Error('The WAV output already exists. Choose a new path or explicitly allow overwrite.') } catch (error) {
        if (!isMissing(error)) throw error
      }
    }
    await this.atomicWrite(filePath, data)
    return { path: this.relative(filePath), bytes: data.byteLength, sha256: createHash('sha256').update(data).digest('hex') }
  }

  async writeProject(input: string, project: Project, options: { expectedRevision?: string; label: string; overwrite?: boolean }) {
    const filePath = await this.projectPath(input, false)
    return this.withWriteLock(filePath, async () => {
      const validated = validateProject(project)
      const text = serializeProject(validated)
      if (Buffer.byteLength(text) > MAX_PROJECT_BYTES) throw new Error('This project exceeds the 250 MB safety limit.')
      let existing: LoadedProject | null = null
      try { existing = await this.readProject(input) } catch (error) { if (!isMissing(error) && !(error instanceof Error && error.message.startsWith('File not found:'))) throw error }
      if (existing && !options.overwrite && options.expectedRevision === undefined) throw new Error('The project already exists. Inspect it and provide its expectedRevision to modify it.')
      if (options.expectedRevision !== undefined) {
        if (!existing) throw new Error('The expected project does not exist.')
        if (existing.revision !== options.expectedRevision) throw new RevisionConflictError(options.expectedRevision, existing.revision)
      }
      if (existing) await this.snapshot(filePath, serializeProject(existing.project), options.label)
      await this.atomicWrite(filePath, text)
      return this.readProject(input)
    })
  }

  async mutateProject(input: string, expectedRevision: string, label: string, mutation: (project: Project) => Project) {
    const loaded = await this.readProject(input)
    if (loaded.revision !== expectedRevision) throw new RevisionConflictError(expectedRevision, loaded.revision)
    const next = touch(mutation(structuredClone(loaded.project)))
    return this.writeProject(input, next, { expectedRevision: loaded.revision, label })
  }

  async listHistory(input: string): Promise<HistoryEntry[]> {
    const filePath = await this.projectPath(input, true)
    const directory = this.historyDirectory(filePath)
    let files: string[]
    try { files = (await readdir(directory)).filter((entry) => entry.endsWith('.resonant')).sort().reverse() } catch (error) { if (isMissing(error)) return []; throw error }
    const entries: HistoryEntry[] = []
    for (const file of files.slice(0, HISTORY_LIMIT)) {
      const fullPath = path.join(directory, file)
      const [text, info] = await Promise.all([readFile(fullPath, 'utf8'), stat(fullPath)])
      const project = parseProject(text)
      entries.push({ id: file, createdAt: info.mtime.toISOString(), revision: hashText(text), title: project.title, bytes: info.size })
    }
    return entries
  }

  async transformHistory(input: string, transform: (project: Project) => Promise<Project> | Project) {
    const filePath = await this.projectPath(input, true)
    const directory = this.historyDirectory(filePath)
    let files: string[]
    try { files = (await readdir(directory)).filter((entry) => entry.endsWith('.resonant')).sort().reverse() } catch (error) { if (isMissing(error)) return { snapshots: 0, changedSnapshots: 0, bytesBefore: 0, bytesAfter: 0 }; throw error }
    let changedSnapshots = 0, bytesBefore = 0, bytesAfter = 0
    for (const file of files) {
      const snapshotPath = path.join(directory, file)
      const text = await readFile(snapshotPath, 'utf8')
      bytesBefore += Buffer.byteLength(text)
      const changed = serializeProject(validateProject(await transform(structuredClone(parseProject(text)))))
      bytesAfter += Buffer.byteLength(changed)
      if (changed !== text) { await this.atomicWrite(snapshotPath, changed); changedSnapshots++ }
    }
    return { snapshots: files.length, changedSnapshots, bytesBefore, bytesAfter }
  }

  async undoLastChange(input: string, expectedRevision: string) {
    const filePath = await this.projectPath(input, true)
    return this.withWriteLock(filePath, async () => {
      const loaded = await this.readProject(input)
      if (loaded.revision !== expectedRevision) throw new RevisionConflictError(expectedRevision, loaded.revision)
      const directory = this.historyDirectory(loaded.path)
      let files: string[]
      try { files = (await readdir(directory)).filter((entry) => entry.endsWith('.resonant')).sort().reverse() } catch (error) { if (isMissing(error)) throw new Error('No agent history is available for this project.'); throw error }
      const latest = files[0]
      if (!latest) throw new Error('No agent history is available for this project.')
      const snapshotPath = path.join(directory, latest)
      const text = await readFile(snapshotPath, 'utf8')
      parseProject(text)
      await this.atomicWrite(loaded.path, text)
      await unlink(snapshotPath)
      return this.readProject(input)
    })
  }

  async listProjects() {
    const results: Array<{ path: string; valid: boolean; title?: string; bpm?: number; revision?: string; error?: string }> = []
    const walk = async (directory: string, depth: number): Promise<void> => {
      if (depth > 3 || results.length >= 100) return
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (results.length >= 100) return
        if (entry.isSymbolicLink()) continue
        const candidate = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && !IGNORED_DIRECTORIES.has(entry.name)) await walk(candidate, depth + 1)
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.resonant')) {
          const relativePath = this.relative(candidate)
          try {
            const loaded = await this.readProject(relativePath)
            results.push({ path: relativePath, valid: true, title: loaded.project.title, bpm: loaded.project.bpm, revision: loaded.revision })
          } catch (error) { results.push({ path: relativePath, valid: false, error: error instanceof Error ? error.message : String(error) }) }
        }
      }
    }
    await walk(this.root, 0)
    return results.sort((a, b) => a.path.localeCompare(b.path))
  }
}
