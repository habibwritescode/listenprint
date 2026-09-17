import { describe, expect, it } from 'vitest'
import { makeArtist, makeTrack } from '../test/factories.ts'
import { albumArtByArtist, artistImageUrls } from './artist-images.ts'

const lead = makeArtist({ id: 'lead', name: 'Lead' })
const guest = makeArtist({ id: 'guest', name: 'Guest' })
const other = makeArtist({ id: 'other', name: 'Other' })

describe('albumArtByArtist', () => {
  it('prefers a track only the artist is credited on, then one they lead, then any other', () => {
    // Newest like first, the order Spotify returns and the Library keeps.
    const tracks = [
      makeTrack({ artists: [other, guest], albumImageUrl: 'featured.jpg' }),
      makeTrack({ artists: [guest, other], albumImageUrl: 'leads.jpg' }),
      makeTrack({ artists: [guest], albumImageUrl: 'alone.jpg' }),
      makeTrack({ artists: [lead, other], albumImageUrl: 'lead-leads.jpg' }),
      makeTrack({ artists: [other, lead], albumImageUrl: 'lead-featured.jpg' }),
    ]

    const art = albumArtByArtist(tracks)

    expect(art.get('guest')).toBe('alone.jpg')
    expect(art.get('lead')).toBe('lead-leads.jpg')
    expect(art.get('other')).toBe('featured.jpg')
  })

  it('takes the most recent like within the same tier, as the old app did', () => {
    const tracks = [
      makeTrack({ artists: [lead], albumImageUrl: 'newest.jpg' }),
      makeTrack({ artists: [lead], albumImageUrl: 'older.jpg' }),
    ]

    expect(albumArtByArtist(tracks).get('lead')).toBe('newest.jpg')
  })

  it('skips tracks without album art', () => {
    const tracks = [
      makeTrack({ artists: [lead], albumImageUrl: null }),
      makeTrack({ artists: [other, lead], albumImageUrl: 'featured.jpg' }),
    ]

    expect(albumArtByArtist(tracks).get('lead')).toBe('featured.jpg')
  })

  // Real Spotify data occasionally lists an artist twice on one track.
  it('counts a track crediting the same artist twice as theirs alone', () => {
    const tracks = [
      makeTrack({ artists: [other, lead], albumImageUrl: 'featured.jpg' }),
      makeTrack({ artists: [lead, lead], albumImageUrl: 'alone.jpg' }),
    ]

    expect(albumArtByArtist(tracks).get('lead')).toBe('alone.jpg')
  })

  it('has nothing for an artist with no album art at all', () => {
    expect(albumArtByArtist([makeTrack({ artists: [lead] })]).has('lead')).toBe(false)
  })
})

describe('artistImageUrls', () => {
  it('uses fetched photos first and album art for everyone else', () => {
    const tracks = [
      makeTrack({ artists: [lead], albumImageUrl: 'lead-album.jpg' }),
      makeTrack({ artists: [guest], albumImageUrl: 'guest-album.jpg' }),
    ]

    expect(artistImageUrls(tracks, { lead: 'lead-photo.jpg' })).toEqual({
      lead: 'lead-photo.jpg',
      guest: 'guest-album.jpg',
    })
  })
})
