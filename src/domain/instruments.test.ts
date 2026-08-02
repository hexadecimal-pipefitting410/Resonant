import { describe, expect, it } from 'vitest'
import { chooseZone } from './instruments'
import { createBlankProject, validateProject } from './project'

describe('instrument model', () => {
  it('selects a matching key and velocity zone', () => {
    const zones = [
      { rootKey: 48, loKey: 0, hiKey: 59, loVel: 0, hiVel: 127 },
      { rootKey: 72, loKey: 60, hiKey: 127, loVel: 0, hiVel: 127 },
    ]
    expect(chooseZone(zones, 67, 0.8)).toBe(zones[1])
  })

  it('keeps installed instruments as lightweight project references', () => {
    const project = createBlankProject()
    project.tracks[2].kind = 'sampler'
    project.tracks[2].instrument = { id: 'generaluser-gs:preset-40-violin', name: 'Violin', packName: 'GeneralUser GS', format: 'soundfont', program: 40, bankMSB: 0, bankLSB: 0 }
    const validated = validateProject(project)
    expect(validated.tracks[2].instrument?.name).toBe('Violin')
    expect(JSON.stringify(validated)).not.toContain('GeneralUser-GS.sf2')
  })
})
