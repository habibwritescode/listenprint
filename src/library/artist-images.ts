import type { LibraryTrack } from './types.ts'

// Lower is better: the cover of a track only the artist is on says the most about them, one they lead a little less.
const ALONE = 0
const LEADS = 1
const FEATURED = 2

/**
 * Album art to stand in for each artist's photo: from a track only they're credited on, else one they're the primary
 * artist on, else any track crediting them. Within a tier the most recent like wins, since tracks are newest first.
 */
export function albumArtByArtist(tracks: readonly LibraryTrack[]): Map<string, string> {
  const best = new Map<string, { tier: number; url: string }>()
  for (const track of tracks) {
    const url = track.albumImageUrl
    if (!url) continue
    const alone = new Set(track.artists.map((artist) => artist.id)).size === 1
    track.artists.forEach((artist, index) => {
      const tier = alone ? ALONE : index === 0 ? LEADS : FEATURED
      const current = best.get(artist.id)
      if (!current || tier < current.tier) best.set(artist.id, { tier, url })
    })
  }
  return new Map([...best].map(([id, { url }]) => [id, url]))
}

/** Every artist's image: a fetched photo when there is one, otherwise album art from their tracks. */
export function artistImageUrls(
  tracks: readonly LibraryTrack[],
  photos: Readonly<Record<string, string>>,
): Record<string, string> {
  return { ...Object.fromEntries(albumArtByArtist(tracks)), ...photos }
}
