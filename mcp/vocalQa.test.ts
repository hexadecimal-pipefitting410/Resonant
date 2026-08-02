import { describe, expect, it } from 'vitest'
import { compareVocalLyrics, lyricWords } from './vocalQa'

describe('vocal lyric quality analysis', () => {
  it('removes performance tags and measures transcript coverage', () => {
    const lyrics = '[Verse - whispered]\nLeave the porch light on\nI will find the road back home'
    expect(lyricWords(lyrics)).toEqual(['leave', 'the', 'porch', 'light', 'on', 'i', 'will', 'find', 'the', 'road', 'back', 'home'])
    const comparison = compareVocalLyrics(lyrics, 'Leave the porch light on, I will find the road home')
    expect(comparison.estimatedCoverage).toBeGreaterThan(0.8)
    expect(comparison.missingOrUnclearWords.some((item) => item.word === 'back')).toBe(true)
  })

  it('counts Devanagari lyric words without splitting vowel marks or nukta forms', () => {
    const lyrics = '[मुखड़ा]\nतू बारिश बन के आ\nखिड़की खुली रखूँगा\nफ़ासला कम हो जाए'
    expect(lyricWords(lyrics)).toEqual(['तू', 'बारिश', 'बन', 'के', 'आ', 'खिड़की', 'खुली', 'रखूँगा', 'फ़ासला', 'कम', 'हो', 'जाए'])
    expect(compareVocalLyrics(lyrics, 'तू बारिश बन के आ खिड़की खुली रखूँगा फ़ासला कम हो जाए').estimatedCoverage).toBe(1)
  })
})
