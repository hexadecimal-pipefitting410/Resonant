import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { parseSfz } = require('./instrument-library.cjs') as { parseSfz(text: string): Array<Record<string, unknown>> }

describe('SFZ import', () => {
  it('inherits global and group opcodes into playable sample zones', () => {
    const zones = parseSfz(`
      <global> lovel=1 hivel=127
      <group> lokey=C3 hikey=B3 volume=-2
      <region> sample="samples/violin C3.wav" pitch_keycenter=C3
      <region> sample=samples/violin_G3.wav pitch_keycenter=G3 lokey=C4 hikey=C5
    `)
    expect(zones).toHaveLength(2)
    expect(zones[0]).toMatchObject({ sample: 'samples/violin C3.wav', rootKey: 48, loKey: 48, hiKey: 59, loVel: 1, hiVel: 127, gainDb: -2 })
    expect(zones[1]).toMatchObject({ rootKey: 55, loKey: 60, hiKey: 72 })
  })
})
