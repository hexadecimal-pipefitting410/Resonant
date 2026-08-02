export type SongSectionKind = 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'post-chorus' | 'bridge' | 'breakdown' | 'outro' | 'other'

export interface SongwritingDraft {
  language: string
  title: string
  idea: string
  hook: string
  pointOfView: 'first-person' | 'second-person' | 'third-person' | 'collective'
  tense: 'past' | 'present' | 'future' | 'mixed'
  mood: string
  genre: string
  audience: string
  imagery: string
  stylePrompt: string
  lyrics: string
}

export interface SongSection {
  label: string
  kind: SongSectionKind
  lines: string[]
}

export interface LineAnalysis {
  text: string
  syllables: number
  lastWord: string
  rhymeKey: string
}

export interface SongwritingAnalysis {
  language: string
  detectedHook: string | null
  sections: Array<SongSection & { linesAnalysis: LineAnalysis[]; rhymeScheme: string }>
  scores: {
    overall: number
    structure: number
    hook: number
    singability: number
    imagery: number
    originality: number
  }
  counts: { sections: number; lines: number; words: number; repeatedLines: number; hookRepetitions: number; intentionalRepeatedLines: number; unintentionalRepeatedLines: number }
  strengths: string[]
  suggestions: string[]
}

export interface SongStructureTemplate {
  id: string
  name: string
  description: string
  sections: string[]
}

export interface SongwritingLanguagePack {
  id: string
  name: string
  locale: string
  aliases?: string[]
  description: string
  templates: SongStructureTemplate[]
  quickSections?: string[]
  lyricPlaceholder?: string
  cliches: string[]
  sensoryWords: string[]
  sectionAliases?: Partial<Record<SongSectionKind, string[]>>
  tokenize?(text: string): string[]
  syllables(word: string): number
  rhymeKey(word: string): string
  review?(draft: Pick<SongwritingDraft, 'title' | 'hook' | 'lyrics'>, sections: SongSection[]): { strengths: string[]; suggestions: string[] }
  coachingGuide: string
}
