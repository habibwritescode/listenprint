import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useState } from 'react'
import type { LibraryTrack } from '../../library/types.ts'

/** 74px row plus a 1px separator, matching the previous app's track list. */
const ROW_HEIGHT = 75

// UTC so a like near midnight never shifts onto the neighbouring day.
const likedDateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

interface ArtistTrackListProps {
  tracks: readonly LibraryTrack[]
  artistName: string
}

// Opts out of React Compiler for the same reason as RankedArtistList; see src/test/virtualizer-jsdom.test.tsx.
export function ArtistTrackList({ tracks, artistName }: ArtistTrackListProps) {
  'use no memo'
  const [scrollMargin, setScrollMargin] = useState(0)
  const virtualizer = useWindowVirtualizer({
    count: tracks.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin,
  })
  const measureList = useCallback((node: HTMLOListElement | null) => {
    if (node) setScrollMargin(node.getBoundingClientRect().top + window.scrollY)
  }, [])

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface/85 shadow-2xl">
      <div
        aria-hidden
        className="hidden min-h-12 grid-cols-[42px_minmax(0,1fr)_108px] items-center gap-3.5 px-3.5 text-[0.8rem] font-black text-subtle uppercase min-[741px]:grid"
      >
        <span>#</span>
        <span>Title</span>
        <span className="justify-self-end">Liked</span>
      </div>
      <ol
        ref={measureList}
        aria-label={`Liked songs by ${artistName}`}
        className="relative"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const track = tracks[item.index]
          const separator = item.index < tracks.length - 1 ? 'border-b border-border/70' : ''
          return (
            <li
              key={track.id}
              aria-setsize={tracks.length}
              aria-posinset={item.index + 1}
              className={`absolute inset-x-0 top-0 grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 bg-surface px-3 min-[741px]:grid-cols-[42px_minmax(0,1fr)_108px] min-[741px]:gap-3.5 min-[741px]:px-3.5 ${separator}`}
              style={{ height: item.size, transform: `translateY(${item.start - scrollMargin}px)` }}
            >
              <span aria-hidden className="font-extrabold text-subtle tabular-nums">
                {item.index + 1}
              </span>
              <span className="grid min-w-0 gap-1">
                <strong className="truncate font-bold text-text">{track.name}</strong>
                <small className="truncate text-sm text-muted">
                  {track.artists.map((artist) => artist.name).join(' • ')}
                </small>
              </span>
              <time
                dateTime={track.addedAt}
                className="justify-self-end text-[0.86rem] font-extrabold text-subtle tabular-nums"
              >
                {likedDateFormat.format(new Date(track.addedAt))}
              </time>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
