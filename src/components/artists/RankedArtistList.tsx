import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useState } from 'react'
import { useRovingListFocus } from '../../hooks/useRovingListFocus.ts'
import { shareOfLibrary, tiedRanks } from '../../library/presentation.ts'
import type { SortOrder } from '../../library/presentation.ts'
import type { ArtistRanking, RankingMode } from '../../library/types.ts'
import { ArtistRow } from './ArtistRow.tsx'
import type { LibraryBase } from './library-paths.ts'
import { SortToggle } from './SortToggle.tsx'
import { ARTIST_ROW_GRID } from './row-format.ts'

/** 76px row plus a 1px separator, the same at every width: the virtualizer's row height can't be responsive. */
const ROW_HEIGHT = 77

interface RankedArtistListProps {
  rankings: readonly ArtistRanking[]
  /** The #1 artist's count across the whole library, so bars stay comparable when the list is filtered. */
  leaderCount: number
  /** The library's size, so shares are of the whole library whatever the list shows. */
  trackCount: number
  mode: RankingMode
  /** In `alpha`, rows arrive in name order and each rank still means the artist's place by count. */
  sort: SortOrder
  basePath: LibraryBase
  /** Artist photos by artist id, for the artists that have one. */
  photos?: Readonly<Record<string, string>>
  /** The panel's heading, such as "1,412 artists in the sample library". */
  label: string
}

// React Compiler caches getVirtualItems() against the virtualizer instance, which never changes, so a
// compiled list would never update on scroll. See src/test/virtualizer-jsdom.test.tsx.
export function RankedArtistList(props: RankedArtistListProps) {
  'use no memo'
  const { rankings, leaderCount, trackCount, mode, sort, basePath, photos, label } = props
  const [scrollMargin, setScrollMargin] = useState(0)
  const virtualizer = useWindowVirtualizer({
    count: rankings.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin,
  })
  const items = virtualizer.getVirtualItems()
  const { attachList, tabbableIndex, onKeyDown, onFocus } = useRovingListFocus({
    count: rankings.length,
    renderedIndexes: items.map((item) => item.index),
    scrollToIndex: (index) => virtualizer.scrollToIndex(index, { align: 'auto' }),
  })
  // Stable, so the list's page offset is measured once on mount rather than on every render mid-scroll.
  const measureList = useCallback(
    (node: HTMLOListElement | null) => {
      attachList(node)
      if (node) setScrollMargin(node.getBoundingClientRect().top + window.scrollY)
    },
    [attachList],
  )
  const tied = tiedRanks(rankings)

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex min-h-11.5 items-center gap-3 border-b border-border px-4 py-2.75">
        <h2 className="text-2xs tracking-[0.09em] text-subtle uppercase tabular-nums">{label}</h2>
        <span className="flex-1" />
        <SortToggle sort={sort} />
      </div>
      {rankings.length === 0 ? (
        <p className="px-6.5 py-16 text-center text-lg font-semibold">No liked songs to rank</p>
      ) : (
        <>
          <div
            data-slot="column-header"
            aria-hidden
            className={`hidden gap-3.5 border-b border-border px-4 py-2 text-2xs tracking-[0.11em] text-subtle uppercase min-[741px]:grid ${ARTIST_ROW_GRID}`}
          >
            <span>{sort === 'alpha' ? 'Rank' : '#'}</span>
            <span />
            <span>Artist</span>
            <span className="text-right">Tracks</span>
            <span>Share of library</span>
          </div>
          <ol
            ref={measureList}
            aria-label="Artists ranked by liked songs"
            className="relative"
            style={{ height: virtualizer.getTotalSize() }}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
          >
            {items.map((item) => {
              const ranking = rankings[item.index]
              const separator = item.index < rankings.length - 1 ? 'border-b border-border' : ''
              return (
                <li
                  key={ranking.artist.id}
                  aria-setsize={rankings.length}
                  aria-posinset={item.index + 1}
                  className={`absolute inset-x-0 top-0 ${separator}`}
                  style={{ height: item.size, transform: `translateY(${item.start - scrollMargin}px)` }}
                >
                  <ArtistRow
                    ranking={ranking}
                    leaderCount={leaderCount}
                    share={shareOfLibrary(ranking.count, trackCount)}
                    tied={sort === 'count' && tied.has(ranking.rank)}
                    dimRank={sort === 'alpha'}
                    mode={mode}
                    sort={sort}
                    basePath={basePath}
                    photoUrl={photos?.[ranking.artist.id]}
                    tabIndex={item.index === tabbableIndex ? 0 : -1}
                  />
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}
