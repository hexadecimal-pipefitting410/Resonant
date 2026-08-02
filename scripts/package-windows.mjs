import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const target = process.argv[2] === 'nsis' ? 'nsis' : 'portable'
const projectRoot = process.cwd()
const staging = await mkdtemp(path.join(tmpdir(), 'resonant-package-'))
const release = path.join(projectRoot, 'release')
const cli = path.join(projectRoot, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js')
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
const version = packageJson.version
const releaseArtifactPattern = /^Resonant(-Setup)?-(\d+\.\d+\.\d+)-Windows-([^.]+)\.exe$/i

async function findExecutables(directory) {
  const matches = []
  for (const entry of await readdir(directory)) {
    const candidate = path.join(directory, entry)
    const info = await stat(candidate)
    if (info.isDirectory()) matches.push(...await findExecutables(candidate))
    else if (entry.toLowerCase().endsWith('.exe') && !candidate.includes('win-unpacked')) matches.push(candidate)
  }
  return matches
}

async function sha256(file) {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(file)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function finalizeRelease() {
  const releaseExecutables = await findExecutables(release)
  for (const artifact of releaseExecutables) {
    const match = path.basename(artifact).match(releaseArtifactPattern)
    if (match && match[2] !== version) await unlink(artifact)
  }

  const currentArtifacts = (await findExecutables(release))
    .map((file) => ({ file, match: path.basename(file).match(releaseArtifactPattern) }))
    .filter(({ match }) => match?.[2] === version)
    .sort((left, right) => path.basename(left.file).localeCompare(path.basename(right.file)))

  if (!currentArtifacts.length) throw new Error(`Release contains no Resonant ${version} Windows artifacts.`)

  const artifacts = []
  for (const { file, match } of currentArtifacts) {
    artifacts.push({
      file: path.basename(file),
      kind: match[1] ? 'installer' : 'portable',
      arch: match[3],
      bytes: (await stat(file)).size,
      sha256: await sha256(file),
    })
  }

  const builtAt = new Date().toISOString()
  await writeFile(
    path.join(release, 'artifacts.json'),
    `${JSON.stringify({ version, builtAt, platform: 'windows', artifacts }, null, 2)}\n`,
  )
  await writeFile(
    path.join(release, 'SHA256SUMS.txt'),
    `${artifacts.map((artifact) => `${artifact.sha256}  ${artifact.file}`).join('\n')}\n`,
  )

  const notes = path.join(projectRoot, 'docs', `release-notes-${version}.md`)
  try {
    await copyFile(notes, path.join(release, 'RELEASE_NOTES.md'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  return artifacts
}

try {
  const builderArgs = [cli, '--win', target, `--config.directories.output=${staging}`]
  if (target === 'nsis') builderArgs.push('--config.win.artifactName=Resonant-Setup-${version}-Windows-${arch}.${ext}')
  const result = spawnSync(process.execPath, builderArgs, { cwd: projectRoot, stdio: 'inherit', shell: false })
  if (result.status !== 0) process.exitCode = result.status ?? 1
  else {
    await mkdir(release, { recursive: true })
    const artifacts = await findExecutables(staging)
    if (!artifacts.length) throw new Error('electron-builder completed without a Windows executable.')
    const copied = []
    for (const artifact of artifacts) {
      const destination = path.join(release, path.basename(artifact))
      await copyFile(artifact, destination)
      copied.push({ file: path.basename(destination), bytes: (await stat(destination)).size })
    }
    const manifest = await finalizeRelease()
    console.log(`Copied ${copied.length} finished artifact(s) to ${release}; ${manifest.length} current release artifact(s) are ready.`)
  }
} finally {
  await rm(staging, { recursive: true, force: true })
}
