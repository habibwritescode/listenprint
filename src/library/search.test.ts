import { describe, expect, it } from 'vitest'
import { makeArtist, makeTrack } from '../test/factories.ts'
import { rankArtists } from './rankings.ts'
import { filterArtists, foldName, highlightParts } from './search.ts'

function rankingsFor(...names: string[]) {
  return rankArtists(
    names.map((name, index) => makeTrack({ artists: [makeArtist({ id: `artist-${index}`, name })] })),
    'all',
  )
}

describe('foldName', () => {
  it('ignores case and accents, so a plain keyboard finds every artist', () => {
    expect(foldName('Björk')).toBe(foldName('bjork'))
    expect(foldName('Sigur Rós')).toBe('sigur ros')
    expect(foldName('ÅSA')).toBe('asa')
  })

  it('leaves letters that have no accent to strip', () => {
    expect(foldName('Straße')).toBe('straße')
    expect(foldName('')).toBe('')
  })

  // Highlighting slices names by where a match sits in the folded text, so folding must never change a length.
  it('keeps the text’s length, whatever the script', () => {
    for (const name of ['Björk', '방탄소년단', 'İstanbul', 'Straße', 'ＡＢＣ', '🎸 riff']) {
      expect(foldName(name).length).toBe(name.length)
    }
  })
})

describe('filterArtists', () => {
  const rankings = rankingsFor('Velvet Harbor', 'Static Choir', 'Björk', 'velveteen rabbit')

  it('keeps the artists whose name contains the query, in the order they were ranked', () => {
    expect(filterArtists(rankings, 'velvet').map((ranking) => ranking.artist.name)).toEqual([
      'Velvet Harbor',
      'velveteen rabbit',
    ])
  })

  it('matches without case or accents, anywhere in the name', () => {
    expect(filterArtists(rankings, 'bjork').map((ranking) => ranking.artist.name)).toEqual(['Björk'])
    expect(filterArtists(rankings, 'choir').map((ranking) => ranking.artist.name)).toEqual(['Static Choir'])
  })

  it('returns everything for an empty query or one made of spaces', () => {
    expect(filterArtists(rankings, '')).toHaveLength(4)
    expect(filterArtists(rankings, '   ')).toHaveLength(4)
  })

  it('returns nothing when no name matches', () => {
    expect(filterArtists(rankings, 'velvt')).toEqual([])
  })
})

describe('highlightParts', () => {
  it('splits a name around the matched text, keeping its own case and accents', () => {
    expect(highlightParts('Velvet Harbor', 'velvet')).toEqual([
      { text: 'Velvet', match: true },
      { text: ' Harbor', match: false },
    ])
    expect(highlightParts('Sigur Rós', 'ros')).toEqual([
      { text: 'Sigur ', match: false },
      { text: 'Rós', match: true },
    ])
  })

  it('slices scripts that fold to a different shape at the right place', () => {
    expect(highlightParts('방탄소년단', '소년')).toEqual([
      { text: '방탄', match: false },
      { text: '소년', match: true },
      { text: '단', match: false },
    ])
  })

  it('marks every occurrence', () => {
    expect(highlightParts('La La Land', 'la')).toEqual([
      { text: 'La', match: true },
      { text: ' ', match: false },
      { text: 'La', match: true },
      { text: ' ', match: false },
      { text: 'La', match: true },
      { text: 'nd', match: false },
    ])
  })

  it('returns the name as one unmatched piece without a query or a match', () => {
    expect(highlightParts('Velvet Harbor', '')).toEqual([{ text: 'Velvet Harbor', match: false }])
    expect(highlightParts('Velvet Harbor', 'choir')).toEqual([{ text: 'Velvet Harbor', match: false }])
    expect(highlightParts('Velvet Harbor', '  ')).toEqual([{ text: 'Velvet Harbor', match: false }])
  })

  // The row still has to read as the artist's name, whatever the pieces are.
  it('rejoins to exactly the original name', () => {
    for (const name of ['Björk', 'LA LA LAND', 'Velvet Harbor', 'straße', '방탄소년단', 'İstanbul']) {
      expect(
        highlightParts(name, 'la')
          .map((part) => part.text)
          .join(''),
      ).toBe(name)
    }
  })
})
