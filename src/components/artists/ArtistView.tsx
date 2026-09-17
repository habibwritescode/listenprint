import { firstLiked, primaryCount, shareOfLibrary, spotifyArtistUrl, tiedRanks } from '../../library/presentation.ts'
import type { SortOrder } from '../../library/presentation.ts'
import { artistTracks, rankArtists } from '../../library/rankings.ts'
import type { ArtistRef, Library, RankingMode } from '../../library/types.ts'
import { ArtistHeader } from './ArtistHeader.tsx'
import { ArtistStats } from './ArtistStats.tsx'
import { ArtistTrackList } from './ArtistTrackList.tsx'
import { CoOccurringArtists } from './CoOccurringArtists.tsx'
import { FeaturedOnlyNotice } from './FeaturedOnlyNotice.tsx'
import { artistKicker, noSpotifyLinkNote } from './artist-format.ts'
import type { LibraryBase } from './library-paths.ts'

interface ArtistViewProps {
  library: Library
  artist: ArtistRef
  mode: RankingMode
  sort: SortOrder
  basePath: LibraryBase
  /** Names the dataset in the kicker, such as "Sample library". */
  libraryName?: string
  photoUrl?: string | null
  /** The artist's genre tags, and why there are none; see `ArtistHeader`. */
  genres?: readonly string[]
  noGenresNote?: string
}

/** One artist in any library: header, stats and saved tracks, or why a featured-only artist has none in this mode. */
export function ArtistView(props: ArtistViewProps) {
  const { library, artist, mode, sort, basePath, libraryName, photoUrl, genres, noGenresNote } = props
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
          library: libraryName,
        })}
        spotifyUrl={spotifyArtistUrl(artist, library.source)}
        noLinkNote={noSpotifyLinkNote(artist, library.source)}
        genres={genres}
        noGenresNote={noGenresNote}
        photoUrl={photoUrl}
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
          <CoOccurringArtists
            tracks={library.tracks}
            artistId={artist.id}
            artistName={artist.name}
            mode={mode}
            sort={sort}
            basePath={basePath}
          />
        </>
      ) : (
        <FeaturedOnlyNotice artist={artist} savedTracks={credited.length} sort={sort} basePath={basePath} />
      )}
    </section>
  )
}
