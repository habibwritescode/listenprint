import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useState } from 'react'
import { useRovingListFocus } from '../../hooks/useRovingListFocus.ts'
import type { ArtistRanking, RankingMode } from '../../library/types.ts'
import { ArtistRow } from './ArtistRow.tsx'

/** 76px row plus a 1px separator, matching the previous app's list. */
const ROW_HEIGHT = 77

interface RankedArtistListProps {
  rankings: readonly ArtistRanking[]
  /** The #1 artist's count across the whole library, so bars stay comparable when the list is filtered. */
  leaderCount: number
  mode: RankingMode
}

// React Compiler caches getVirtualItems() against the virtualizer instance, which never changes, so a
// compiled list would never update on scroll. See src/test/virtualizer-jsdom.test.tsx.
export function RankedArtistList({ rankings, leaderCount, mode }: RankedArtistListProps) {
  'use no memo'
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

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface/85 shadow-2xl">
      <div
        aria-hidden
        className="hidden min-h-12 grid-cols-[68px_minmax(0,1fr)_112px] items-center gap-4 px-4.5 text-[0.8rem] font-black text-subtle uppercase min-[741px]:grid"
      >
        <span>Rank</span>
        <span>Artist</span>
        <span>Liked songs</span>
      </div>
      {rankings.length === 0 ? (
        <p className="px-4.5 py-8 text-muted">No liked songs</p>
      ) : (
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
            const separator = item.index < rankings.length - 1 ? 'border-b border-border/70' : ''
            return (
              <li
                key={ranking.artist.id}
                aria-setsize={rankings.length}
                aria-posinset={item.index + 1}
                className={`absolute inset-x-0 top-0 bg-surface ${separator}`}
                style={{ height: item.size, transform: `translateY(${item.start - scrollMargin}px)` }}
              >
                <ArtistRow
                  ranking={ranking}
                  leaderCount={leaderCount}
                  mode={mode}
                  tabIndex={item.index === tabbableIndex ? 0 : -1}
                />
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
