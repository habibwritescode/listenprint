import { describe, expect, it } from 'vitest'
import { makeArtist, makeTrack } from '../test/factories.ts'
import {
  artistInitial,
  avatarTone,
  barWidthPercent,
  concentration,
  firstLiked,
  isSortOrder,
  libraryStats,
  ordinal,
  primaryCount,
  roundedPercents,
  shareOfLibrary,
  sortRankings,
  spotifyArtistUrl,
  spotifyTrackUrl,
  tiedRanks,
} from './presentation.ts'
import { rankArtists } from './rankings.ts'

describe('libraryStats', () => {
  it('counts tracks, ranked artists, and the leader count', () => {
    const artistA = makeArtist({ id: 'a' })
    const tracks = [
      makeTrack({ artists: [artistA, makeArtist()] }),
      makeTrack({ artists: [artistA] }),
      makeTrack({ artists: [makeArtist()] }),
    ]

    const stats = libraryStats(rankArtists(tracks, 'all'), tracks)

    expect(stats).toEqual({ trackCount: 3, artistCount: 3, leaderCount: 2 })
  })

  it('returns zeros for an empty library', () => {
    expect(libraryStats([], [])).toEqual({ trackCount: 0, artistCount: 0, leaderCount: 0 })
  })
})

describe('barWidthPercent', () => {
  it('gives the leader a full bar', () => {
    expect(barWidthPercent(40, 40)).toBe(100)
  })

  it('scales other counts against the leader', () => {
    expect(barWidthPercent(20, 40)).toBe(50)
  })

  it('keeps small counts visible with a 4% floor', () => {
    expect(barWidthPercent(1, 1_000)).toBe(4)
  })

  it('never exceeds a full bar', () => {
    expect(barWidthPercent(5, 2)).toBe(100)
  })

  it('returns 0 when there is no leader count', () => {
    expect(barWidthPercent(3, 0)).toBe(0)
  })
})

describe('artistInitial', () => {
  it('uppercases the first letter', () => {
    expect(artistInitial('emile rowe')).toBe('E')
  })

  it('keeps accented letters, including decomposed ones', () => {
    expect(artistInitial('Émile Rowe')).toBe('É')
    expect(artistInitial('Émile Rowe')).toBe('É')
  })

  it('skips leading symbols, digits, and emoji', () => {
    expect(artistInitial('#1 Crew')).toBe('C')
    expect(artistInitial('4ever Club')).toBe('E')
    expect(artistInitial('🎧 beats')).toBe('B')
  })

  it('keeps a letter whose uppercase form is more than one character', () => {
    expect(artistInitial('ßeta')).toBe('ß')
  })

  it.each(['', '123', '!!!'])('falls back to # for %j, which has no letter', (name) => {
    expect(artistInitial(name)).toBe('#')
  })
})

describe('spotifyArtistUrl', () => {
  it('links a Spotify artist to open.spotify.com', () => {
    const artist = makeArtist({ id: '4Z8W4fKeB5YxbusRsdQVPb' })

    expect(spotifyArtistUrl(artist, 'spotify')).toBe('https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb')
  })

  it('has no link for demo artists', () => {
    expect(spotifyArtistUrl(makeArtist({ id: '4Z8W4fKeB5YxbusRsdQVPb' }), 'demo')).toBeNull()
  })

  it('has no link for local-file artists', () => {
    expect(spotifyArtistUrl(makeArtist({ id: 'local:Garage Demos' }), 'spotify')).toBeNull()
  })
})

describe('spotifyTrackUrl', () => {
  it('links a Spotify track to open.spotify.com', () => {
    const track = makeTrack({ id: '6rqhFgbbKwnb9MLmUQDhG6' })

    expect(spotifyTrackUrl(track, 'spotify')).toBe('https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6')
  })

  it('has no link for demo tracks', () => {
    expect(spotifyTrackUrl(makeTrack({ id: '6rqhFgbbKwnb9MLmUQDhG6' }), 'demo')).toBeNull()
  })

  it('has no link for local files', () => {
    expect(spotifyTrackUrl(makeTrack({ id: 'local:::Garage+Demos:Demo+1:180' }), 'spotify')).toBeNull()
  })
})

/** For each entry in `counts`, a solo artist with that many tracks, named so rows sort in input order. */
function soloLibrary(counts: readonly number[]) {
  return counts.flatMap((count, index) => {
    const artist = makeArtist({ name: `Solo ${String(index).padStart(3, '0')}` })
    return Array.from({ length: count }, () => makeTrack({ artists: [artist] }))
  })
}

describe('concentration', () => {
  it('splits tracks between ranks 1–10, ranks 11–100, and everyone below', () => {
    const tracks = soloLibrary([...Array(10).fill(3), ...Array(90).fill(2), ...Array(20).fill(1)])

    expect(concentration(rankArtists(tracks, 'all'), tracks.length)).toEqual({
      top10Artists: 10,
      top10Tracks: 30,
      next90Artists: 90,
      next90Tracks: 180,
      restArtists: 20,
      restTracks: 20,
    })
  })

  it('counts a track once when several top-10 artists share it', () => {
    const lead = makeArtist({ name: 'Lead' })
    const guest = makeArtist({ name: 'Guest' })
    const tracks = [makeTrack({ artists: [lead, guest] }), makeTrack({ artists: [lead] })]

    expect(concentration(rankArtists(tracks, 'all'), tracks.length)).toMatchObject({
      top10Artists: 2,
      top10Tracks: 2,
      next90Tracks: 0,
      restTracks: 0,
    })
  })

  it('counts only primary credits in primary mode', () => {
    const lead = makeArtist({ name: 'Lead' })
    const guest = makeArtist({ name: 'Guest' })
    const others = soloLibrary(Array(10).fill(2))
    const tracks = [makeTrack({ artists: [lead, guest] }), ...others]

    // In primary mode the guest counts nothing, and Lead's one track ranks it 11th, behind ten two-track artists.
    const result = concentration(rankArtists(tracks, 'primary'), tracks.length)

    expect(result).toMatchObject({ top10Artists: 10, top10Tracks: 20, next90Artists: 1, next90Tracks: 1 })
  })

  it('keeps artists tied at rank 10 together in the top 10', () => {
    const tracks = soloLibrary([...Array(9).fill(3), ...Array(3).fill(2), 1])
    const rankings = rankArtists(tracks, 'all')

    expect(rankings.slice(9, 12).map((ranking) => ranking.rank)).toEqual([10, 10, 10])
    expect(concentration(rankings, tracks.length)).toMatchObject({
      top10Artists: 12,
      top10Tracks: 33,
      next90Artists: 1,
      next90Tracks: 1,
    })
  })

  it('keeps artists tied at rank 100 together in the next 90', () => {
    const tracks = soloLibrary([...Array(10).fill(3), ...Array(89).fill(2), ...Array(4).fill(1)])
    const rankings = rankArtists(tracks, 'all')

    expect(rankings.at(-1)?.rank).toBe(100)
    expect(concentration(rankings, tracks.length)).toMatchObject({
      top10Artists: 10,
      next90Artists: 93,
      restArtists: 0,
      restTracks: 0,
    })
  })

  it('has nothing to report for an empty library', () => {
    expect(concentration([], 0)).toBeNull()
  })
})

describe('roundedPercents', () => {
  it('rounds parts so they always add up to 100', () => {
    expect(roundedPercents([1, 1, 1])).toEqual([34, 33, 33])
    expect(roundedPercents([4_193, 2_900, 2_907])).toEqual([42, 29, 29])
  })

  it('keeps exact percentages unchanged', () => {
    expect(roundedPercents([50, 25, 25])).toEqual([50, 25, 25])
  })

  it('returns zeros when there is nothing to divide', () => {
    expect(roundedPercents([0, 0])).toEqual([0, 0])
  })
})

describe('shareOfLibrary', () => {
  it('divides a count by the library size', () => {
    expect(shareOfLibrary(318, 10_000)).toBeCloseTo(0.0318)
  })

  it('is 0 for an empty library', () => {
    expect(shareOfLibrary(0, 0)).toBe(0)
  })
})

describe('tiedRanks', () => {
  it('collects every rank held by more than one artist', () => {
    const tracks = soloLibrary([5, 4, 4, 3, 2, 2, 2, 1])

    expect(tiedRanks(rankArtists(tracks, 'all'))).toEqual(new Set([2, 5]))
  })

  it('is empty when every rank is unique', () => {
    const tracks = soloLibrary([3, 2, 1])

    expect(tiedRanks(rankArtists(tracks, 'all')).size).toBe(0)
  })
})

describe('primaryCount', () => {
  it('counts tracks where the artist is credited first', () => {
    const artist = makeArtist()
    const tracks = [
      makeTrack({ artists: [artist] }),
      makeTrack({ artists: [artist, makeArtist()] }),
      makeTrack({ artists: [makeArtist(), artist] }),
      makeTrack(),
    ]

    expect(primaryCount(artist.id, tracks)).toBe(2)
  })

  it('skips a track with no credited artists', () => {
    expect(primaryCount('anyone', [makeTrack({ artists: [] })])).toBe(0)
  })
})

describe('firstLiked', () => {
  it('gives the month of the earliest like, in UTC', () => {
    const tracks = [
      makeTrack({ addedAt: '2024-03-10T12:00:00Z' }),
      // 23:30 on 31 March in UTC-2 is already April in UTC.
      makeTrack({ addedAt: '2019-03-31T23:30:00-02:00' }),
      makeTrack({ addedAt: '2021-07-01T00:00:00Z' }),
    ]

    expect(firstLiked(tracks)).toBe('2019-04')
  })

  it('is null without tracks', () => {
    expect(firstLiked([])).toBeNull()
  })
})

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [102, '102nd'],
    [111, '111th'],
    [1_412, '1,412th'],
  ])('writes %i as %s', (n, expected) => {
    expect(ordinal(n)).toBe(expected)
  })
})

describe('avatarTone', () => {
  it("matches the design's name hash", () => {
    // Expected values computed with the design file's hash: h = (h * 31 + code) | 0, then Math.abs(h) % 4 + 1.
    expect(avatarTone('Velvet Harbor')).toBe(1)
    expect(avatarTone('Mira Duarte')).toBe(1)
    expect(avatarTone('Static Choir')).toBe(4)
    expect(avatarTone('')).toBe(1)
  })

  it('is always between 1 and 4', () => {
    const tones = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(avatarTone))

    expect([...tones].every((tone) => tone >= 1 && tone <= 4)).toBe(true)
  })
})

describe('sortRankings', () => {
  const tracks = [
    ...soloLibrary([1]),
    makeTrack({ artists: [makeArtist({ id: 'b', name: 'beta' })] }),
    makeTrack({ artists: [makeArtist({ id: 'a', name: 'Alpha 10' })] }),
    makeTrack({ artists: [makeArtist({ id: 'a2', name: 'Alpha 9' })] }),
    makeTrack({ artists: [makeArtist({ id: 'e', name: 'Éclair' })] }),
  ]
  const rankings = rankArtists(tracks, 'all')

  it('keeps count order unchanged', () => {
    expect(sortRankings(rankings, 'count')).toBe(rankings)
  })

  it('orders by name ignoring case and accents, with numbers in numeric order', () => {
    expect(sortRankings(rankings, 'alpha').map((ranking) => ranking.artist.name)).toEqual([
      'Alpha 9',
      'Alpha 10',
      'beta',
      'Éclair',
      'Solo 000',
    ])
  })

  it('keeps each artist its count rank', () => {
    const zed = makeArtist({ name: 'Zed' })
    const counted = [
      ...Array.from({ length: 3 }, () => makeTrack({ artists: [zed] })),
      makeTrack({ artists: [makeArtist({ name: 'Ant' })] }),
    ]

    const sorted = sortRankings(rankArtists(counted, 'all'), 'alpha')

    expect(sorted.map((ranking) => [ranking.artist.name, ranking.rank])).toEqual([
      ['Ant', 2],
      ['Zed', 1],
    ])
  })

  it('breaks name ties by rank, then id', () => {
    const twins = [
      makeTrack({ artists: [makeArtist({ id: 'z', name: 'Twin' })] }),
      makeTrack({ artists: [makeArtist({ id: 'y', name: 'twin' })] }),
      makeTrack({ artists: [makeArtist({ id: 'z', name: 'Twin' })] }),
      makeTrack({ artists: [makeArtist({ id: 'x', name: 'TWIN' })] }),
    ]

    const ranked = rankArtists(twins, 'all')

    for (const input of [ranked, [...ranked].reverse()]) {
      expect(sortRankings(input, 'alpha').map((ranking) => ranking.artist.id)).toEqual(['z', 'x', 'y'])
    }
  })
})

describe('isSortOrder', () => {
  it.each([
    ['count', true],
    ['alpha', true],
    ['name', false],
    [undefined, false],
  ])('%j → %j', (value, expected) => {
    expect(isSortOrder(value)).toBe(expected)
  })
})
