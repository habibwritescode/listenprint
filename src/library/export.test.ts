import { describe, expect, it } from 'vitest'
import { makeArtist, makeTrack } from '../test/factories.ts'
import { exportFileName, exportRows, toCsv } from './export.ts'
import { rankArtists } from './rankings.ts'
import type { ArtistRanking } from './types.ts'

function rankingsFor(...names: string[]): ArtistRanking[] {
  return rankArtists(
    names.map((name, index) =>
      makeTrack({
        addedAt: `2025-0${(index % 9) + 1}-05T00:00:00.000Z`,
        artists: [makeArtist({ id: `artist-${index}`, name })],
      }),
    ),
    'all',
  )
}

function rows(csv: string): string[] {
  return csv.replace('﻿', '').trimEnd().split('\r\n')
}

describe('toCsv', () => {
  it('writes a header and one row per artist, with the figures the app shows', () => {
    const rankings = rankingsFor('Velvet Harbor', 'Static Choir')
    const csv = toCsv(rankings, 2)

    expect(rows(csv)[0]).toBe('Rank,Artist,Liked songs,Share of library,As primary,First liked')
    expect(rows(csv).slice(1).sort()).toEqual(['1,Static Choir,1,50.0%,1,2025-02', '1,Velvet Harbor,1,50.0%,1,2025-01'])
    expect(rows(csv).slice(1).map((row) => row.split(',')[1])).toEqual(rankings.map((one) => one.artist.name))
  })

  // A spreadsheet reads the BOM as UTF-8, which is what keeps accented names from arriving as mojibake.
  it('starts with a byte order mark and separates rows with CRLF', () => {
    const csv = toCsv(rankingsFor('Björk'), 1)

    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('\r\n')
    expect(csv).toContain('Björk')
  })

  it('quotes a name with a comma, a quote or a newline', () => {
    const csv = toCsv(rankingsFor('Earth, Wind & Fire', 'The "Band"', 'Two\nLines'), 3)

    expect(rows(csv)[1]).toContain('"Earth, Wind & Fire"')
    expect(rows(csv)[2]).toContain('"The ""Band"""')
    expect(csv).toContain('"Two\nLines"')
  })

  // rankArtists never builds one, but the contract allows it, and a blank cell beats the word "null" in a spreadsheet.
  it('leaves the first-liked cell empty for a ranking with no tracks', () => {
    const ranking: ArtistRanking = { artist: makeArtist({ name: 'Nobody' }), rank: 1, count: 0, tracks: [] }

    expect(rows(toCsv([ranking], 0))[1]).toBe('1,Nobody,0,0.0%,0,')
  })

  it('writes just the header for an empty ranking', () => {
    expect(rows(toCsv([], 0))).toEqual(['Rank,Artist,Liked songs,Share of library,As primary,First liked'])
  })
})

describe('exportFileName', () => {
  it('names the file by kind and date', () => {
    expect(exportFileName('csv', 'spotify', new Date('2026-09-17T10:00:00Z'))).toBe(
      'listenprint-top-artists-2026-09-17.csv',
    )
    expect(exportFileName('png', 'spotify', new Date('2026-01-02T10:00:00Z'))).toBe(
      'listenprint-top-artists-2026-01-02.png',
    )
  })

  // A sample export says so in its own name, as well as in the image.
  it('marks a sample export', () => {
    expect(exportFileName('png', 'demo', new Date('2026-09-17T10:00:00Z'))).toBe(
      'sample-listenprint-top-artists-2026-09-17.png',
    )
  })
})

describe('exportRows', () => {
  const many = rankingsFor(...Array.from({ length: 30 }, (_, index) => `Artist ${index}`))

  it('takes the first twenty, in the order the list shows them', () => {
    const drawn = exportRows(many)

    expect(drawn).toHaveLength(20)
    expect(drawn.map((row) => row.name)).toEqual(many.slice(0, 20).map((one) => one.artist.name))
  })

  it('gives each row its rank, count and bar length against the leader', () => {
    const rankings = rankArtists(
      [
        makeTrack({ artists: [makeArtist({ id: 'a', name: 'Leader' })] }),
        makeTrack({ artists: [makeArtist({ id: 'a', name: 'Leader' })] }),
        makeTrack({ artists: [makeArtist({ id: 'b', name: 'Runner Up' })] }),
      ],
      'all',
    )

    expect(exportRows(rankings)).toEqual([
      { id: 'a', rank: 1, name: 'Leader', count: 2, barPercent: 100 },
      { id: 'b', rank: 2, name: 'Runner Up', count: 1, barPercent: 50 },
    ])
  })

  it('draws nothing for an empty ranking', () => {
    expect(exportRows([])).toEqual([])
  })
})
