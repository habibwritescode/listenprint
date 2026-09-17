import { describe, expect, it } from 'vitest'
import { rankArtists } from '../../library/rankings.ts'
import { makeArtist, makeTrack } from '../../test/factories.ts'
import { tiesNote } from './ranking-notes.ts'

function solo(counts: readonly number[]) {
  return counts.flatMap((count, index) => {
    const artist = makeArtist({ name: `Solo ${String(index).padStart(3, '0')}` })
    return Array.from({ length: count }, () => makeTrack({ artists: [artist] }))
  })
}

describe('tiesNote', () => {
  it.each([
    [[3, 2, 1], 'No ties in your top 100'],
    [[3, 2, 2, 1], '1 tie in your top 100'],
    [[4, 3, 3, 2, 2, 1], '2 ties in your top 100'],
  ])('counts tied ranks for %j', (counts, expected) => {
    expect(tiesNote(rankArtists(solo(counts), 'all'))).toBe(expected)
  })

  it('ignores ties below rank 100', () => {
    const tracks = solo([...Array.from({ length: 100 }, (_, i) => 200 - i), 1, 1])

    expect(tiesNote(rankArtists(tracks, 'all'))).toBe('No ties in your top 100')
  })
})
