import { describe, expect, it } from 'vitest'
import { makeArtist, makeTrack } from '../test/factories.ts'
import type { ArtistRef } from './types.ts'
import {
  DEFAULT_RANKING_MODE,
  RANKING_MODES,
  artistTracks,
  isRankingMode,
  rankArtists,
} from './rankings.ts'

// Ported from old/test/rankings.test.js, with competition ranks added to the assertions.
const artistA = makeArtist({ id: 'artist-a', name: 'Artist A' })
const artistB = makeArtist({ id: 'artist-b', name: 'Artist B' })
const artistC = makeArtist({ id: 'artist-c', name: 'Artist C' })

const portedTracks = [
  makeTrack({ name: 'One', artists: [artistA, artistB] }),
  makeTrack({ name: 'Two', artists: [artistA] }),
  makeTrack({ name: 'Three', artists: [artistC] }),
]

function likedTimes(artist: ArtistRef, count: number) {
  return Array.from({ length: count }, () => makeTrack({ artists: [artist] }))
}

describe('rankArtists', () => {
  it('counts every credited artist in all mode', () => {
    const ranked = rankArtists(portedTracks, 'all')

    expect(ranked.map((r) => [r.artist.name, r.count, r.rank])).toEqual([
      ['Artist A', 2, 1],
      ['Artist B', 1, 2],
      ['Artist C', 1, 2],
    ])
  })

  it('counts only the primary artist in primary mode', () => {
    const ranked = rankArtists(portedTracks, 'primary')

    expect(ranked.map((r) => [r.artist.name, r.count, r.rank])).toEqual([
      ['Artist A', 2, 1],
      ['Artist C', 1, 2],
    ])
  })
})

describe('artistTracks', () => {
  it('finds a featured artist in all mode but not in primary mode', () => {
    const allMode = artistTracks(portedTracks, 'artist-b', 'all')
    const primaryMode = artistTracks(portedTracks, 'artist-b', 'primary')

    expect(allMode.map((track) => track.name)).toEqual(['One'])
    expect(primaryMode).toEqual([])
  })

  it('returns no tracks for an unknown artist id', () => {
    expect(artistTracks(portedTracks, 'missing', 'all')).toEqual([])
  })
})

describe('rankArtists counting', () => {
  it('counts an artist once per track even when credited twice', () => {
    const repeated = makeArtist({ id: 'repeated' })
    const tracks = [makeTrack({ artists: [repeated, makeArtist(), repeated] })]

    const ranking = rankArtists(tracks, 'all').find((r) => r.artist.id === 'repeated')

    expect(ranking?.count).toBe(1)
    expect(ranking?.tracks).toHaveLength(1)
  })

  it.each(['all', 'primary'] as const)('skips tracks with no credited artists in %s mode', (mode) => {
    const tracks = [makeTrack({ artists: [] }), makeTrack({ artists: [artistA] })]

    const ranked = rankArtists(tracks, mode)

    expect(ranked.map((r) => [r.artist.id, r.count])).toEqual([['artist-a', 1]])
  })

  it('merges local-file artists by id and keeps them apart from a same-named Spotify artist', () => {
    const tracks = [
      makeTrack({ artists: [makeArtist({ id: 'local:Foo', name: 'Foo' })] }),
      makeTrack({ artists: [makeArtist({ id: 'local:Foo', name: 'Foo' })] }),
      makeTrack({ artists: [makeArtist({ id: '4Z8W4fKeB5YxbusRsdQVPb', name: 'Foo' })] }),
    ]

    const ranked = rankArtists(tracks, 'all')

    expect(ranked.map((r) => [r.artist.id, r.count])).toEqual([
      ['local:Foo', 2],
      ['4Z8W4fKeB5YxbusRsdQVPb', 1],
    ])
  })

  it('keeps the first-seen name when an artist appears under different names', () => {
    const tracks = [
      makeTrack({ artists: [makeArtist({ id: 'renamed', name: 'New Name' })] }),
      makeTrack({ artists: [makeArtist({ id: 'renamed', name: 'Old Name' })] }),
    ]

    const [ranking] = rankArtists(tracks, 'all')

    expect(ranking.artist.name).toBe('New Name')
  })

  it('lists counted tracks in library order with count equal to tracks.length', () => {
    const tracks = [
      makeTrack({ name: 'Newest', artists: [artistA] }),
      makeTrack({ name: 'Other', artists: [artistB] }),
      makeTrack({ name: 'Oldest', artists: [artistB, artistA] }),
    ]

    const ranked = rankArtists(tracks, 'all')

    for (const ranking of ranked) {
      expect(ranking.count).toBe(ranking.tracks.length)
    }
    const a = ranked.find((r) => r.artist.id === 'artist-a')
    expect(a?.tracks.map((track) => track.name)).toEqual(['Newest', 'Oldest'])
  })

  it('returns an empty ranking for an empty library', () => {
    expect(rankArtists([], 'all')).toEqual([])
  })
})

describe('rankArtists ordering', () => {
  it('breaks count ties by name ignoring case and accents, then by id', () => {
    const tracks = [
      ...likedTimes(makeArtist({ id: 'a-zed', name: 'Zed' }), 1),
      ...likedTimes(makeArtist({ id: 'y', name: 'Same' }), 1),
      ...likedTimes(makeArtist({ id: 'c', name: 'Emile' }), 1),
      ...likedTimes(makeArtist({ id: 'x', name: 'Same' }), 1),
      ...likedTimes(makeArtist({ id: 'b', name: 'émile' }), 1),
    ]

    const ranked = rankArtists(tracks, 'all')

    expect(ranked.map((r) => r.artist.id)).toEqual(['b', 'c', 'x', 'y', 'a-zed'])
  })

  it.each([
    ['y', 'x'],
    ['x', 'y'],
  ])('orders identical names by id when inserted as %s then %s', (first, second) => {
    const tracks = [
      ...likedTimes(makeArtist({ id: first, name: 'Same' }), 1),
      ...likedTimes(makeArtist({ id: second, name: 'Same' }), 1),
    ]

    const ranked = rankArtists(tracks, 'all')

    expect(ranked.map((r) => r.artist.id)).toEqual(['x', 'y'])
  })

  it('gives equal counts the same rank and skips the ranks they share', () => {
    const tracks = [
      ...likedTimes(makeArtist({ id: 'one', name: 'One' }), 1),
      ...likedTimes(makeArtist({ id: 'three-a', name: 'Three A' }), 3),
      ...likedTimes(makeArtist({ id: 'five', name: 'Five' }), 5),
      ...likedTimes(makeArtist({ id: 'three-b', name: 'Three B' }), 3),
    ]

    const ranked = rankArtists(tracks, 'all')

    expect(ranked.map((r) => [r.count, r.rank])).toEqual([
      [5, 1],
      [3, 2],
      [3, 2],
      [1, 4],
    ])
  })
})

describe('artistTracks consistency', () => {
  const repeated = makeArtist({ id: 'repeated' })
  const tracks = [
    ...portedTracks,
    makeTrack({ artists: [makeArtist({ id: 'local:Foo', name: 'Foo' })] }),
    makeTrack({ artists: [repeated, artistC, repeated] }),
    makeTrack({ artists: [] }),
  ]

  it.each(['all', 'primary'] as const)('matches the tracks counted by rankArtists in %s mode', (mode) => {
    for (const ranking of rankArtists(tracks, mode)) {
      expect(artistTracks(tracks, ranking.artist.id, mode)).toEqual(ranking.tracks)
    }
  })
})

describe('ranking modes', () => {
  it('lists both modes with all as the default', () => {
    expect(RANKING_MODES).toEqual(['all', 'primary'])
    expect(DEFAULT_RANKING_MODE).toBe('all')
  })

  it.each(['all', 'primary'])('accepts %s', (value) => {
    expect(isRankingMode(value)).toBe(true)
  })

  it.each(['', 'ALL', 'Primary', undefined, null, 1])('rejects %s', (value) => {
    expect(isRankingMode(value)).toBe(false)
  })
})
