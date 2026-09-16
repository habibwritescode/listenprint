import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArtistHeader } from '../components/artists/ArtistHeader.tsx'
import { ArtistTrackList } from '../components/artists/ArtistTrackList.tsx'
import { demoLibraryQueryOptions } from '../demo/demo-library-query.ts'
import { spotifyArtistUrl } from '../library/presentation.ts'
import { rankArtists } from '../library/rankings.ts'

const route = getRouteApi('/demo/artist/$artistId')

export function DemoArtistPage() {
  const { artist } = route.useLoaderData()
  const { mode } = route.useSearch()
  const { data: library } = useSuspenseQuery(demoLibraryQueryOptions)
  const ranking = rankArtists(library.tracks, mode).find((candidate) => candidate.artist.id === artist.id) ?? null

  return (
    <section aria-labelledby="artist-title" className="space-y-6">
      <ArtistHeader
        artist={artist}
        ranking={ranking}
        spotifyUrl={spotifyArtistUrl(artist, library.source)}
      />
      {ranking && <ArtistTrackList tracks={ranking.tracks} artistName={artist.name} />}
    </section>
  )
}
