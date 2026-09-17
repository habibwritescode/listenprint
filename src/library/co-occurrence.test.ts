import { describe, expect, it } from 'vitest'
import { makeArtist, makeTrack } from '../test/factories.ts'
import { coOccurringArtists } from './co-occurrence.ts'

const subject = makeArtist({ id: 'subject', name: 'Velvet Harbor' })
const mira = makeArtist({ id: 'mira', name: 'Mira Duarte' })
const choir = makeArtist({ id: 'choir', name: 'Static Choir' })

describe('coOccurringArtists', () => {
  it('ranks the artists sharing the most liked songs', () => {
    const tracks = [
      makeTrack({ artists: [subject, mira] }),
      makeTrack({ artists: [subject, mira] }),
      makeTrack({ artists: [subject, choir] }),
    ]

    expect(coOccurringArtists(tracks, subject.id, 'all').map((entry) => [entry.artist.name, entry.shared])).toEqual([
      ['Mira Duarte', 2],
      ['Static Choir', 1],
    ])
  })

  // "Of theirs" answers how much of that artist's own library this overlap is, so it counts all their liked songs.
  it('shares against the other artist’s own liked songs, in every mode', () => {
    const tracks = [
      makeTrack({ artists: [subject, mira] }),
      makeTrack({ artists: [mira] }),
      makeTrack({ artists: [mira, choir] }),
      makeTrack({ artists: [choir, subject] }),
    ]

    const [first] = coOccurringArtists(tracks, subject.id, 'primary')
    expect(first.artist.name).toBe('Mira Duarte')
    expect(first.shareOfTheirs).toBeCloseTo(1 / 3)
  })

  it('follows the mode through the subject’s own songs', () => {
    const tracks = [makeTrack({ artists: [subject, mira] }), makeTrack({ artists: [choir, subject] })]

    expect(coOccurringArtists(tracks, subject.id, 'all').map((entry) => entry.artist.name)).toEqual([
      'Mira Duarte',
      'Static Choir',
    ])
    expect(coOccurringArtists(tracks, subject.id, 'primary').map((entry) => entry.artist.name)).toEqual(['Mira Duarte'])
  })

  it('breaks ties by name', () => {
    const tracks = [makeTrack({ artists: [subject, choir] }), makeTrack({ artists: [subject, mira] })]

    expect(coOccurringArtists(tracks, subject.id, 'all').map((entry) => entry.artist.name)).toEqual([
      'Mira Duarte',
      'Static Choir',
    ])
  })

  it('never lists the artist themselves, even on a song crediting them twice', () => {
    const tracks = [makeTrack({ artists: [subject, subject, mira] })]
    const entries = coOccurringArtists(tracks, subject.id, 'all')

    expect(entries.map((entry) => entry.artist.id)).toEqual(['mira'])
    expect(entries[0].shared).toBe(1)
  })

  it('counts a repeated credit on one song once', () => {
    const tracks = [makeTrack({ artists: [subject, mira, mira] })]

    expect(coOccurringArtists(tracks, subject.id, 'all')[0].shared).toBe(1)
  })

  it('keeps the table short', () => {
    const others = Array.from({ length: 7 }, (_, index) => makeArtist({ id: `other-${index}` }))
    const tracks = others.map((artist) => makeTrack({ artists: [subject, artist] }))

    expect(coOccurringArtists(tracks, subject.id, 'all')).toHaveLength(5)
    expect(coOccurringArtists(tracks, subject.id, 'all', 2)).toHaveLength(2)
  })

  it('returns nothing for an artist whose songs credit nobody else', () => {
    expect(coOccurringArtists([makeTrack({ artists: [subject] })], subject.id, 'all')).toEqual([])
  })

  it('returns nothing for an artist who is not in the library', () => {
    expect(coOccurringArtists([makeTrack({ artists: [mira] })], subject.id, 'all')).toEqual([])
  })
})
