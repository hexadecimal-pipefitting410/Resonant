import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'

const root = process.cwd()
const graphPath = path.join(root, 'docs', 'delivery-graph.yaml')
const graph = parse(await readFile(graphPath, 'utf8'))
const states = new Set(['proposed', 'ready', 'active', 'blocked', 'implemented', 'verified', 'superseded'])
const errors = []

if (!graph || graph.version !== 1 || !Array.isArray(graph.nodes)) errors.push('Graph must contain version 1 and a nodes array.')
const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
const byId = new Map()
for (const node of nodes) {
  if (!node?.id || byId.has(node.id)) errors.push(`Missing or duplicate node ID: ${String(node?.id)}`)
  else byId.set(node.id, node)
  if (!states.has(node?.state)) errors.push(`Invalid state for ${String(node?.id)}: ${String(node?.state)}`)
  for (const field of ['depends_on', 'acceptance', 'verification', 'evidence', 'risks', 'decision_refs']) if (!Array.isArray(node?.[field])) errors.push(`${String(node?.id)}.${field} must be an array.`)
  if (node?.state === 'verified' && !node.evidence?.length) errors.push(`Verified node ${String(node?.id)} has no evidence.`)
}

for (const node of nodes) for (const dependency of node.depends_on ?? []) if (!byId.has(dependency)) errors.push(`${node.id} depends on missing node ${dependency}.`)

const visiting = new Set(), visited = new Set()
function visit(id, trail = []) {
  if (visiting.has(id)) { errors.push(`Dependency cycle: ${[...trail, id].join(' -> ')}`); return }
  if (visited.has(id)) return
  visiting.add(id)
  for (const dependency of byId.get(id)?.depends_on ?? []) visit(dependency, [...trail, id])
  visiting.delete(id); visited.add(id)
}
for (const id of byId.keys()) visit(id)

for (const node of nodes.filter((candidate) => candidate.state === 'verified')) for (const evidence of node.evidence) {
  try { await access(path.resolve(root, evidence)) } catch { errors.push(`Evidence for ${node.id} is missing: ${evidence}`) }
}

if (errors.length) {
  errors.forEach((error) => process.stderr.write(`${error}\n`))
  process.exitCode = 1
} else process.stdout.write(`Work graph valid: ${nodes.length} nodes, ${nodes.filter((node) => node.state === 'verified').length} verified.\n`)
