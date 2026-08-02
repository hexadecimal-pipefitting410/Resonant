import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const output = path.join(root, 'mcp-dist')
await mkdir(output, { recursive: true })
await build({
  entryPoints: [path.join(root, 'mcp', 'server.ts')],
  outfile: path.join(output, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  legalComments: 'none',
})
console.error('Built Resonant MCP server at mcp-dist/server.mjs')
