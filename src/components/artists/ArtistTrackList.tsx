import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery.ts'
import { useRestoredWindowOffset } from '../../hooks/useRestoredWindowOffset.ts'
import { useRovingListFocus } from '../../hooks/useRovingListFocus.ts'
import { spotifyTrackUrl } from '../../library/presentation.ts'
import type { Library, LibraryTrack } from '../../library/types.ts'
import { ArtistAvatar } from './ArtistAvatar.tsx'

/**
 * 63px plus a 1px separator from 741px up, where the date has its own column; below that the date folds into the
 * second line and rows are 74px plus the separator, leaving room for a 44px touch target.
 */
const WIDE_ROW_HEIGHT = 64
const NARROW_ROW_HEIGHT = 75

// Written out in full so Tailwind finds each class. The Album column only exists at 741px and up; below that the album
// joins the second line.
const TRACK_GRIDS = {
  'links-albums':
    'grid-cols-[40px_minmax(0,1fr)_44px] min-[741px]:grid-cols-[28px_40px_minmax(0,1.4fr)_minmax(0,1fr)_92px_34px]',
  'links-noAlbums': 'grid-cols-[40px_minmax(0,1fr)_44px] min-[741px]:grid-cols-[28px_40px_minmax(0,1fr)_92px_34px]',
  'noLinks-albums': 'grid-cols-[40px_minmax(0,1fr)] min-[741px]:grid-cols-[28px_40px_minmax(0,1.4fr)_minmax(0,1fr)_92px]',
  'noLinks-noAlbums': 'grid-cols-[40px_minmax(0,1fr)] min-[741px]:grid-cols-[28px_40px_minmax(0,1fr)_92px]',
} as const

// UTC so a like near midnight never shifts onto the neighbouring day.
const likedDateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

interface ArtistTrackListProps {
  tracks: readonly LibraryTrack[]
  /** The artist whose page this is, left out of each track's "with" line. */
  artistId: string
  artistName: string
  source: Library['source']
}

function LikedDate({ addedAt, className }: { addedAt: string; className?: string }) {
  return (
    <time dateTime={addedAt} className={className}>
      {likedDateFormat.format(new Date(addedAt))}
    </time>
  )
}

// Opts out of React Compiler for the same reason as RankedArtistList; see src/test/virtualizer-jsdom.test.tsx.
export function ArtistTrackList({ tracks, artistId, artistName, source }: ArtistTrackListProps) {
  'use no memo'
  const rowHeight = useMediaQuery('(min-width: 741px)') ? WIDE_ROW_HEIGHT : NARROW_ROW_HEIGHT
  const [scrollMargin, setScrollMargin] = useState(0)
  const initialOffset = useRestoredWindowOffset()
  const virtualizer = useWindowVirtualizer({
    count: tracks.length,
    estimateSize: () => rowHeight,
    overscan: 10,
    scrollMargin,
    initialOffset,
  })
  // Sizes are cached per row, so crossing the breakpoint has to discard them.
  useEffect(() => {
    virtualizer.measure()
  }, [virtualizer, rowHeight])
  const items = virtualizer.getVirtualItems()
  const { attachList, tabbableIndex, onKeyDown, onFocus } = useRovingListFocus({
    count: tracks.length,
    renderedIndexes: items.map((item) => item.index),
    scrollToIndex: (index) => virtualizer.scrollToIndex(index, { align: 'auto' }),
  })
  const measureList = useCallback(
    (node: HTMLOListElement | null) => {
      attachList(node)
      if (node) setScrollMargin(node.getBoundingClientRect().top + window.scrollY)
    },
    [attachList],
  )
  const hasLinks = tracks.some((track) => spotifyTrackUrl(track, source) !== null)
  // The roving Tab stop can land on a local file, which has no link; the first rendered row with one takes it instead.
  const tabbableTrack = tracks.at(tabbableIndex)
  const tabStopIndex =
    tabbableIndex >= 0 && tabbableTrack && spotifyTrackUrl(tabbableTrack, source)
      ? tabbableIndex
      : (items.find((item) => spotifyTrackUrl(tracks[item.index], source) !== null)?.index ?? -1)
  const hasAlbums = tracks.some((track) => track.albumName !== null)
  const grid = TRACK_GRIDS[`${hasLinks ? 'links' : 'noLinks'}-${hasAlbums ? 'albums' : 'noAlbums'}`]
  const artNote = source === 'demo' ? 'Sample library — no album art' : 'Album art from Spotify'

  return (
    <section aria-labelledby="saved-tracks-title">
      <div className="flex flex-wrap items-baseline gap-x-2.75 gap-y-1">
        <h2 id="saved-tracks-title" className="text-lg font-semibold">
          Saved tracks
        </h2>
        <p className="text-2xs tracking-[0.06em] text-subtle">
          {hasLinks ? 'Dates shown in UTC · ↗ opens the track in Spotify in a new tab' : 'Dates shown in UTC'}
        </p>
        <p className="text-2xs tracking-[0.06em] text-subtle">{artNote}</p>
      </div>
      <div className="mt-3.25 overflow-hidden rounded-lg border border-border bg-surface">
        <div
          aria-hidden
          data-slot="track-columns"
          className={`hidden gap-3.5 border-b border-border px-4 py-2 text-2xs tracking-[0.11em] text-subtle uppercase min-[741px]:grid ${grid}`}
        >
          <span>#</span>
          <span />
          <span>Track</span>
          {hasAlbums && <span>Album</span>}
          <span className="text-right">Liked</span>
          {hasLinks && <span />}
        </div>
        <ol
          ref={measureList}
          aria-label={`Liked songs by ${artistName}`}
          className="relative"
          style={{ height: virtualizer.getTotalSize() }}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
        >
          {items.map((item) => {
            const track = tracks[item.index]
            const url = spotifyTrackUrl(track, source)
            const others = track.artists.filter((artist) => artist.id !== artistId).map((artist) => artist.name)
            const separator = item.index < tracks.length - 1 ? 'border-b border-border' : ''
            return (
              <li
                key={track.id}
                aria-setsize={tracks.length}
                aria-posinset={item.index + 1}
                className={`absolute inset-x-0 top-0 grid items-center gap-3.5 px-4 transition-colors hover:bg-raised-surface ${grid} ${separator}`}
                style={{ height: item.size, transform: `translateY(${item.start - scrollMargin}px)` }}
              >
                <span aria-hidden className="hidden text-xs text-subtle tabular-nums min-[741px]:block">
                  {String(item.index + 1).padStart(2, '0')}
                </span>
                <span data-slot="art">
                  <ArtistAvatar name={track.albumName ?? track.name} size="art" imageUrl={track.albumImageUrl} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-md">{track.name}</span>
                  <span className="mt-0.75 block truncate text-sm text-muted">
                    {others.length > 0 && `with ${others.join(', ')}`}
                    <span className="min-[741px]:hidden">
                      {others.length > 0 && ' · '}
                      {track.albumName && `${track.albumName} · `}
                      <LikedDate addedAt={track.addedAt} />
                    </span>
                  </span>
                </span>
                {hasAlbums && (
                  <span className="hidden min-w-0 truncate text-sm text-muted min-[741px]:block">{track.albumName}</span>
                )}
                <LikedDate
                  addedAt={track.addedAt}
                  className="hidden text-right text-xs text-subtle tabular-nums min-[741px]:block"
                />
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    tabIndex={item.index === tabStopIndex ? 0 : -1}
                    aria-label={`Open ${track.name} in Spotify — opens in a new tab`}
                    className="flex size-11 items-center justify-center rounded-md border border-border text-base text-subtle transition-colors hover:border-accent hover:bg-soft-accent hover:text-bright-accent min-[741px]:size-8.5"
                  >
                    <span aria-hidden>↗</span>
                  </a>
                ) : (
                  hasLinks && <span />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
