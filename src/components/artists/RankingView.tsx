import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSearchQuery } from '../../hooks/search-query.ts'
import { libraryStats, sortRankings } from '../../library/presentation.ts'
import type { SortOrder } from '../../library/presentation.ts'
import { rankArtists } from '../../library/rankings.ts'
import { filterArtists } from '../../library/search.ts'
import type { Library, RankingMode } from '../../library/types.ts'
import { NoSearchResults } from './NoSearchResults.tsx'
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
  /** Marks the list as the previous scan's while a refresh runs. */
  stale?: boolean
  /** Above the stats, such as a refresh's progress. */
  lead?: ReactNode
  panelAction?: ReactNode
  emptyState?: ReactNode
  /** Below the list. */
  children?: ReactNode
}

const countFormat = new Intl.NumberFormat()

/** Stats and the ranked list for any library: the demo and the signed-in user's library render the same view. */
export function RankingView(props: RankingViewProps) {
  const { library, mode, sort, basePath, title, notes, listSuffix = '', photos, stale = false } = props
  const { lead, panelAction, emptyState, children } = props
  const { query, setQuery } = useSearchQuery()
  const navigate = useNavigate()
  const rankings = rankArtists(library.tracks, mode)
  const { leaderCount } = libraryStats(rankings, library.tracks)
  // The stats above describe the library; only the list below is filtered.
  const matches = filterArtists(rankings, query)
  const matchCount = countFormat.format(matches.length)
  const artistCount = countFormat.format(rankings.length)
  const unfilteredLabel = sort === 'alpha' ? `${artistCount} artists, A to Z` : `${artistCount} artists${listSuffix}`
  const label = query
    ? `${matchCount} ${matches.length === 1 ? 'artist matches' : 'artists match'} “${query}”`
    : unfilteredLabel

  return (
    <section aria-labelledby="ranking-title" className="space-y-4">
      <h1 id="ranking-title" className="sr-only">
        {title}
      </h1>
      {lead}
      <StatsSummary rankings={rankings} trackCount={library.tracks.length} notes={notes} />
      <RankedArtistList
        rankings={sortRankings(matches, sort)}
        leaderCount={leaderCount}
        trackCount={library.tracks.length}
        mode={mode}
        sort={sort}
        basePath={basePath}
        photos={photos}
        panelAction={panelAction}
        query={query}
        note={query && matches.length > 0 ? 'This filtered view has its own link — copy the address to share it' : null}
        emptyState={
          query && rankings.length > 0 ? (
            <NoSearchResults
              query={query}
              onClear={() => {
                setQuery('')
                void navigate({ to: basePath, search: (previous) => ({ ...previous, q: '' }), replace: true })
              }}
            />
          ) : (
            emptyState
          )
        }
        label={stale ? `${label} · from your last scan` : label}
      />
      {children}
    </section>
  )
}
