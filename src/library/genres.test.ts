import { describe, expect, it } from 'vitest'
import { makeArtist, makeTrack } from '../test/factories.ts'
import type { ArtistRef } from './types.ts'
import { MIN_GENRE_COVERAGE, genreBreakdown, hasEnoughGenreCoverage } from './genres.ts'
import type { ArtistGenres } from './genres.ts'

const dreamPop = makeArtist({ id: 'dream', name: 'Dream Pop Artist' })
const artRock = makeArtist({ id: 'rock', name: 'Art Rock Artist' })
const untagged = makeArtist({ id: 'untagged', name: 'Untagged Artist' })
const unknown = makeArtist({ id: 'unknown', name: 'Never Looked Up' })

const genres: ArtistGenres = new Map([
  [dreamPop.id, ['dream pop', 'shoegaze']],
  [artRock.id, ['art rock']],
  // Looked up, and Spotify returned nothing.
  [untagged.id, []],
])

function tracksBy(...credits: ArtistRef[][]) {
  return credits.map((artists) => makeTrack({ artists }))
}

describe('genreBreakdown', () => {
  it('ranks genres by the songs they are tagged on', () => {
    const breakdown = genreBreakdown(tracksBy([dreamPop], [dreamPop], [artRock]), genres, 'all')

    expect(breakdown.genres.map((genre) => [genre.name, genre.tracks])).toEqual([
      ['dream pop', 2],
      ['shoegaze', 2],
      ['art rock', 1],
    ])
    expect(breakdown.genres[0].share).toBeCloseTo(2 / 3)
  })

  it('counts a song once per genre, however many of its artists carry it', () => {
    const alsoDreamPop = makeArtist({ id: 'dream-2', name: 'Second Dream Pop Artist' })
    const withBoth: ArtistGenres = new Map([...genres, [alsoDreamPop.id, ['dream pop']]])
    const breakdown = genreBreakdown(tracksBy([dreamPop, alsoDreamPop]), withBoth, 'all')

    expect(breakdown.genres.find((genre) => genre.name === 'dream pop')).toMatchObject({ tracks: 1, artists: 2 })
  })

  it('attributes through the primary artist only in primary mode', () => {
    const tracks = tracksBy([artRock, dreamPop])

    expect(genreBreakdown(tracks, genres, 'all').genres.map((genre) => genre.name)).toEqual([
      'art rock',
      'dream pop',
      'shoegaze',
    ])
    expect(genreBreakdown(tracks, genres, 'primary').genres.map((genre) => genre.name)).toEqual(['art rock'])
  })

  it('names the artist a genre mostly comes from', () => {
    const otherRock = makeArtist({ id: 'rock-2', name: 'Other Art Rock Artist' })
    const withOther: ArtistGenres = new Map([...genres, [otherRock.id, ['art rock']]])
    const breakdown = genreBreakdown(tracksBy([artRock], [artRock], [otherRock]), withOther, 'all')

    expect(breakdown.genres[0]).toMatchObject({ name: 'art rock', artists: 2, topArtist: 'Art Rock Artist' })
  })

  it('names the leading artist wherever they sit in the credits', () => {
    const otherRock = makeArtist({ id: 'rock-2', name: 'Other Art Rock Artist' })
    const withOther: ArtistGenres = new Map([...genres, [otherRock.id, ['art rock']]])
    const breakdown = genreBreakdown(tracksBy([artRock], [otherRock], [otherRock]), withOther, 'all')

    expect(breakdown.genres[0].topArtist).toBe('Other Art Rock Artist')
  })

  it('breaks ties by name, so the order never wanders between renders', () => {
    const breakdown = genreBreakdown(tracksBy([dreamPop], [artRock]), genres, 'all')

    expect(breakdown.genres.map((genre) => genre.name)).toEqual(['art rock', 'dream pop', 'shoegaze'])
  })

  it('keeps only the top genres', () => {
    const many: ArtistGenres = new Map([[dreamPop.id, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']]])
    expect(genreBreakdown(tracksBy([dreamPop]), many, 'all').genres).toHaveLength(8)
  })

  // Coverage is the honest part: shares are out of tagged songs, so the reader needs to know how many that is.
  it('counts coverage in songs with at least one tagged artist', () => {
    const tracks = tracksBy([dreamPop], [untagged], [unknown], [untagged, artRock])
    const breakdown = genreBreakdown(tracks, genres, 'all')

    expect(breakdown).toMatchObject({ trackCount: 4, taggedTracks: 2 })
    expect(breakdown.coverage).toBeCloseTo(0.5)
  })

  it('reports no coverage for a library where nothing was looked up', () => {
    const breakdown = genreBreakdown(tracksBy([unknown]), new Map(), 'all')

    expect(breakdown).toMatchObject({ trackCount: 1, taggedTracks: 0, coverage: 0, genres: [] })
  })

  it('reports nothing for an empty library', () => {
    expect(genreBreakdown([], genres, 'all')).toMatchObject({ trackCount: 0, taggedTracks: 0, coverage: 0 })
  })

  // Nothing stops Spotify repeating a tag on one artist, and counting it twice would weigh that artist double.
  it('counts a repeated tag on one artist once', () => {
    const otherRock = makeArtist({ id: 'rock-2', name: 'Other Art Rock Artist' })
    const repeated: ArtistGenres = new Map([
      [artRock.id, ['art rock', 'art rock']],
      [otherRock.id, ['art rock']],
    ])
    const breakdown = genreBreakdown(tracksBy([artRock], [otherRock], [otherRock]), repeated, 'all')

    expect(breakdown.genres).toEqual([
      { name: 'art rock', tracks: 3, share: 1, artists: 2, topArtist: 'Other Art Rock Artist' },
    ])
  })

  it('ignores a repeated credit on one song', () => {
    const breakdown = genreBreakdown(tracksBy([dreamPop, dreamPop]), genres, 'all')

    expect(breakdown.genres[0]).toMatchObject({ name: 'dream pop', tracks: 1, artists: 1 })
  })
})

describe('hasEnoughGenreCoverage', () => {
  // A chart built on a few percent of a library would rank noise; the view says so instead.
  it('needs a quarter of the library tagged, the boundary included', () => {
    expect(hasEnoughGenreCoverage(MIN_GENRE_COVERAGE)).toBe(true)
    expect(hasEnoughGenreCoverage(MIN_GENRE_COVERAGE - 0.001)).toBe(false)
    expect(hasEnoughGenreCoverage(0)).toBe(false)
  })
})
