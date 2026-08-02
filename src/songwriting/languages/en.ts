import type { SongwritingLanguagePack } from '../types'

const exceptions: Record<string, number> = {
  every: 2, everything: 3, fire: 1, hour: 1, our: 1, quiet: 2, rhythm: 2, poetry: 3, beautiful: 3,
  family: 3, memory: 3, memories: 3, different: 3, camera: 3, chocolate: 2, evening: 2,
}

function englishSyllables(raw: string) {
  const word = raw.toLowerCase().replace(/[^a-z']/g, '')
  if (!word) return 0
  if (exceptions[word]) return exceptions[word]
  if (word.length <= 3) return 1
  const reduced = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/i, '').replace(/^y/, '')
  return Math.max(1, reduced.match(/[aeiouy]{1,2}/g)?.length ?? 1)
}

function englishRhymeKey(raw: string) {
  const word = raw.toLowerCase().replace(/[^a-z]/g, '')
  if (!word) return ''
  const match = word.match(/[aeiouy][^aeiouy]*$/)
  return match?.[0] ?? word.slice(-3)
}

export const englishSongwriting: SongwritingLanguagePack = {
  id: 'en',
  name: 'English',
  locale: 'en-US',
  aliases: ['English', 'en-US'],
  description: 'Modern English lyrics with hook, prosody, rhyme, imagery, and section-contrast coaching.',
  templates: [
    { id: 'modern-pop', name: 'Modern Pop', description: 'Fast hook arrival and two chorus payoffs.', sections: ['Verse 1', 'Pre-Chorus', 'Chorus', 'Verse 2', 'Pre-Chorus', 'Chorus', 'Bridge', 'Final Chorus', 'Outro'] },
    { id: 'story-song', name: 'Story Song', description: 'A clear scene, escalation, and changed final refrain.', sections: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Verse 3', 'Bridge', 'Final Chorus'] },
    { id: 'short-form', name: 'Short & Addictive', description: 'Compact form for a 90-second generator.', sections: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse 2', 'Final Chorus', 'Outro'] },
    { id: 'slow-burn', name: 'Slow-Burn Ballad', description: 'Space for detail and an emotional late lift.', sections: ['Verse 1', 'Verse 2', 'Chorus', 'Verse 3', 'Chorus', 'Bridge', 'Final Chorus', 'Outro'] },
  ],
  quickSections: ['Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro'],
  cliches: ['broken heart', 'city lights', 'endless night', 'set me free', 'spread my wings', 'burning desire', 'lost without you', 'tears fall like rain', 'against all odds', 'meant to be', 'take my breath away', 'forever and always'],
  sensoryWords: ['taste', 'salt', 'sweet', 'bitter', 'touch', 'skin', 'cold', 'warm', 'heat', 'rough', 'soft', 'hear', 'sound', 'ring', 'whisper', 'roar', 'smell', 'scent', 'smoke', 'rain', 'neon', 'shadow', 'red', 'blue', 'gold', 'glass', 'street', 'kitchen', 'hallway', 'door', 'window'],
  syllables: englishSyllables,
  rhymeKey: englishRhymeKey,
  coachingGuide: `Write natural, singable English rather than generic poetry. Build one central promise around a short title or hook. Let verses earn the chorus through specific scenes, actions, objects, and consequences. Keep neighboring lines rhythmically compatible without making every line mechanically identical. Use rhyme to create motion, not to force syntax. Contrast sections through line length, perspective, energy, or imagery. Prefer concrete nouns and active verbs. Avoid unexplained abstractions, filler, stock AI phrases, and a perfect rhyme that weakens the thought. The bridge must reveal, reframe, or decide something; it must not be a third verse with a new label.`,
}
