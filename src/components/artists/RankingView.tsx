import type { ReactNode } from 'react'
import { libraryStats, sortRankings } from '../../library/presentation.ts'
import type { SortOrder } from '../../library/presentation.ts'
import { rankArtists } from '../../library/rankings.ts'
import type { Library, RankingMode } from '../../library/types.ts'
import { RankedArtistList } from './RankedArtistList.tsx'
import { StatsSummary } from './StatsSummary.tsx'
import type { LibraryBase } from './library-paths.ts'

interface RankingViewProps {
  library: Library
  mode: RankingMode
  sort: SortOrder
  basePath: LibraryBase
  /** The page's visually hidden heading. */
  title: string
  /** Notes under the saved-tracks and artists figures. */
  notes: { tracks: string; artists: string }
  /** Ends the list heading in count order, such as " in the sample library". */
  listSuffix?: string
  photos?: Readonly<Record<string, string>>
  /** Below the list. */
  children?: ReactNode
}

const countFormat = new Intl.NumberFormat()

/** Stats and the ranked list for any library: the demo and the signed-in user's library render the same view. */
export function RankingView(props: RankingViewProps) {
  const { library, mode, sort, basePath, title, notes, listSuffix = '', photos, children } = props
  const rankings = rankArtists(library.tracks, mode)
  const { leaderCount } = libraryStats(rankings, library.tracks)
  const artistCount = countFormat.format(rankings.length)

  return (
    <section aria-labelledby="ranking-title" className="space-y-4">
      <h1 id="ranking-title" className="sr-only">
        {title}
      </h1>
      <StatsSummary rankings={rankings} trackCount={library.tracks.length} notes={notes} />
      <RankedArtistList
        rankings={sortRankings(rankings, sort)}
        leaderCount={leaderCount}
        trackCount={library.tracks.length}
        mode={mode}
        sort={sort}
        basePath={basePath}
        photos={photos}
        label={sort === 'alpha' ? `${artistCount} artists, A to Z` : `${artistCount} artists${listSuffix}`}
      />
      {children}
    </section>
  )
}
