import { describe, expect, it } from 'vitest'
import { normalizeSavedTracks } from './normalize.ts'

function catalogItem(overrides: Record<string, unknown> = {}) {
  return {
    added_at: '2026-02-14T09:30:00Z',
    track: {
      type: 'track',
      id: '6rqhFgbbKwnb9MLmUQDhG6',
      uri: 'spotify:track:6rqhFgbbKwnb9MLmUQDhG6',
      is_local: false,
      name: 'Slow Light',
      artists: [
        { id: '0OdUWJ0sBjDrqHygGUXeCF', name: 'Velvet Harbor' },
        { id: '1vCWHaC5f2uS3yhpwWbIA6', name: 'Mira Duarte' },
      ],
      album: {
        name: 'Common Weather',
        images: [
          { url: 'https://i.scdn.co/image/640', width: 640, height: 640 },
          { url: 'https://i.scdn.co/image/300', width: 300, height: 300 },
          { url: 'https://i.scdn.co/image/64', width: 64, height: 64 },
        ],
      },
      ...overrides,
    },
  }
}

describe('normalizeSavedTracks', () => {
  it('turns a catalog saved track into a library track, keeping credit order', () => {
    expect(normalizeSavedTracks([catalogItem()])).toEqual({
      tracks: [
        {
          id: '6rqhFgbbKwnb9MLmUQDhG6',
          name: 'Slow Light',
          addedAt: '2026-02-14T09:30:00Z',
          albumName: 'Common Weather',
          albumImageUrl: 'https://i.scdn.co/image/300',
          artists: [
            { id: '0OdUWJ0sBjDrqHygGUXeCF', name: 'Velvet Harbor' },
            { id: '1vCWHaC5f2uS3yhpwWbIA6', name: 'Mira Duarte' },
          ],
        },
      ],
      skipped: 0,
    })
  })

  // The tile is 40px, so 80px covers a 2x screen without downloading the 640px cover.
  it('picks the smallest album image at least 80px wide', () => {
    const images = [
      { url: 'https://i.scdn.co/image/64', width: 64, height: 64 },
      { url: 'https://i.scdn.co/image/300', width: 300, height: 300 },
      { url: 'https://i.scdn.co/image/640', width: 640, height: 640 },
    ]
    const [track] = normalizeSavedTracks([catalogItem({ album: { name: 'A', images } })]).tracks

    expect(track.albumImageUrl).toBe('https://i.scdn.co/image/300')
  })

  it('falls back to the widest image when none is 80px or wider, or to the first when widths are unknown', () => {
    const small = [
      { url: 'https://i.scdn.co/image/32', width: 32, height: 32 },
      { url: 'https://i.scdn.co/image/64', width: 64, height: 64 },
      { url: 'https://i.scdn.co/image/16', width: 16, height: 16 },
    ]
    const unknown = [
      { url: 'https://i.scdn.co/image/a', width: null, height: null },
      { url: 'https://i.scdn.co/image/b', width: null, height: null },
    ]

    const [fromSmall, fromUnknown] = normalizeSavedTracks([
      catalogItem({ album: { name: 'A', images: small } }),
      catalogItem({ id: '7aaaaaaaaaaaaaaaaaaaaa', album: { name: 'B', images: unknown } }),
    ]).tracks

    expect(fromSmall.albumImageUrl).toBe('https://i.scdn.co/image/64')
    expect(fromUnknown.albumImageUrl).toBe('https://i.scdn.co/image/a')
  })

  it('has no album name or image when the album has none', () => {
    const [noAlbum, emptyAlbum] = normalizeSavedTracks([
      catalogItem({ album: undefined }),
      catalogItem({ id: '7aaaaaaaaaaaaaaaaaaaaa', album: { name: '', images: [] } }),
    ]).tracks

    expect([noAlbum.albumName, noAlbum.albumImageUrl]).toEqual([null, null])
    expect([emptyAlbum.albumName, emptyAlbum.albumImageUrl]).toEqual([null, null])
  })

  // Local files have no Spotify ids: the track keys on its URI and each artist on its name, per the Library contract.
  it('gives local files and their artists local: ids', () => {
    const local = catalogItem({
      id: null,
      is_local: true,
      uri: 'spotify:local:Garage+Band:Demos:Voice+Memo:180',
      name: 'Voice Memo',
      artists: [{ id: null, name: 'Garage Band' }],
      album: { name: 'Demos', images: [] },
    })

    const [track] = normalizeSavedTracks([local]).tracks

    expect(track.id).toBe('local:spotify:local:Garage+Band:Demos:Voice+Memo:180')
    expect(track.artists).toEqual([{ id: 'local:Garage Band', name: 'Garage Band' }])
  })

  it.each([
    ['a null track', { added_at: '2026-02-14T09:30:00Z', track: null }],
    ['an episode', catalogItem({ type: 'episode' })],
    ['a catalog track without an id', catalogItem({ id: null })],
    ['a local file without a URI', catalogItem({ id: null, is_local: true, uri: undefined })],
    ['a missing name', catalogItem({ name: '' })],
    ['no artists', catalogItem({ artists: [] })],
    ['artists that are not a list', catalogItem({ artists: 'Velvet Harbor' })],
    ['an artist without a name', catalogItem({ artists: [{ id: 'x' }] })],
    ['a missing liked date', { ...catalogItem(), added_at: undefined }],
    ['an unparseable liked date', { ...catalogItem(), added_at: 'yesterday' }],
    ['something that is not an object', 'track'],
  ])('skips %s and counts it, without throwing', (_case, item) => {
    expect(normalizeSavedTracks([catalogItem(), item])).toMatchObject({ tracks: [{ name: 'Slow Light' }], skipped: 1 })
  })

  it('ignores malformed album images rather than skipping the track', () => {
    const images = [null, { url: 42 }, { url: 'https://i.scdn.co/image/300', width: 300 }]

    const [track] = normalizeSavedTracks([catalogItem({ album: { name: 7, images } })]).tracks

    expect(track.albumImageUrl).toBe('https://i.scdn.co/image/300')
    expect(track.albumName).toBeNull()
  })
})
