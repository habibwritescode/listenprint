import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArtistHeader } from '../components/artists/ArtistHeader.tsx'
import { ArtistStats } from '../components/artists/ArtistStats.tsx'
import { ArtistTrackList } from '../components/artists/ArtistTrackList.tsx'
import { FeaturedOnlyNotice } from '../components/artists/FeaturedOnlyNotice.tsx'
import { artistKicker, noSpotifyLinkNote } from '../components/artists/artist-format.ts'
import { demoLibraryQueryOptions } from '../demo/demo-library-query.ts'
import { firstLiked, primaryCount, shareOfLibrary, spotifyArtistUrl, tiedRanks } from '../library/presentation.ts'
import { artistTracks, rankArtists } from '../library/rankings.ts'

const route = getRouteApi('/demo/artist/$artistId')

export function DemoArtistPage() {
  const { artist } = route.useLoaderData()
  const { mode, sort } = route.useSearch()
  const { data: library } = useSuspenseQuery(demoLibraryQueryOptions)
  const rankings = rankArtists(library.tracks, mode)
  const ranking = rankings.find((candidate) => candidate.artist.id === artist.id) ?? null
  // Every credit, whatever the mode: the primary count and first like describe the artist, not the ranking.
  const credited = artistTracks(library.tracks, artist.id, 'all')

  return (
    <section aria-labelledby="artist-title" className="space-y-6.5 pt-2">
      <ArtistHeader
        artist={artist}
        kicker={artistKicker({
          ranking,
          tied: ranking !== null && tiedRanks(rankings).has(ranking.rank),
          artistCount: rankings.length,
          library: 'Sample library',
        })}
        spotifyUrl={spotifyArtistUrl(artist, library.source)}
        noLinkNote={noSpotifyLinkNote(artist, library.source)}
      />
      {ranking ? (
        <>
          <ArtistStats
            savedTracks={ranking.count}
            share={shareOfLibrary(ranking.count, library.tracks.length)}
            asPrimary={primaryCount(artist.id, credited)}
            firstLiked={firstLiked(credited)}
          />
          <ArtistTrackList
            tracks={ranking.tracks}
            artistId={artist.id}
            artistName={artist.name}
            source={library.source}
          />
        </>
      ) : (
        <FeaturedOnlyNotice artist={artist} savedTracks={credited.length} sort={sort} />
      )}
    </section>
  )
}
