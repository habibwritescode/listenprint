import { Link } from '@tanstack/react-router'
import { useId } from 'react'
import { barWidthPercent } from '../../library/presentation.ts'
import { highlightParts } from '../../library/search.ts'
import { artistTileName } from '../../navigation/view-transitions.ts'
import type { SortOrder } from '../../library/presentation.ts'
import type { ArtistRanking, RankingMode } from '../../library/types.ts'
import { ArtistAvatar } from './ArtistAvatar.tsx'
import { artistPath } from './library-paths.ts'
import type { LibraryBase } from './library-paths.ts'
import { ARTIST_ROW_GRID, artistRowDetails, formatShare } from './row-format.ts'

interface ArtistRowProps {
  ranking: ArtistRanking
  leaderCount: number
  /** Share of the library as a fraction, always against the whole library. */
  share: number
  /** The rank is shared with another artist. Marked, so a repeated number doesn't look like a bug. */
  tied: boolean
  /** Out of sequence in A–Z order, so it's shown dimmed. */
  dimRank: boolean
  mode: RankingMode
  sort: SortOrder
  basePath: LibraryBase
  /** Painted over the letter tile when the artist has one. */
  photoUrl?: string
  /** 0 for the list's single Tab stop, -1 for every other row. */
  tabIndex: number
  /** Marked inside the name, so a match is visible without changing what the link is called. */
  query?: string
}

const countFormat = new Intl.NumberFormat()

export function ArtistRow(props: ArtistRowProps) {
  const { ranking, leaderCount, share, tied, dimRank, mode, sort, basePath, photoUrl, tabIndex, query = '' } = props
  const { artist, rank, count, tracks } = ranking
  const detailsId = useId()
  const sample = tracks
    .slice(0, 3)
    .map((track) => track.name)
    .join(' · ')

  return (
    // The artist name is the link, and its ::after overlay stretches the click target over the whole row. A link
    // wrapping every column would have to be named by all of its text, rank and sample tracks included, or its
    // accessible name wouldn't match what voice-control users see and say (WCAG 2.5.3).
    <div
      className={`relative grid h-full items-center gap-3.5 px-4 transition-colors hover:bg-raised-surface has-[a:focus-visible]:rounded-md has-[a:focus-visible]:shadow-[inset_0_0_0_2px_var(--color-accent),0_0_0_1px_var(--color-bright-accent)] ${ARTIST_ROW_GRID}`}
    >
      <span aria-hidden className={`flex items-center gap-1 text-md tabular-nums ${dimRank ? 'text-subtle' : 'text-muted'}`}>
        {rank}
        {tied && <span className="text-[9px] text-highlight">=</span>}
      </span>
      <ArtistAvatar name={artist.name} imageUrl={photoUrl} transitionName={artistTileName(artist.id)} />
      <span className="min-w-0">
        <Link
          to={artistPath(basePath)}
          params={{ artistId: artist.id }}
          // The filter travels with the link, so the list behind the artist page is the one that was on screen.
          search={(previous) => ({ ...previous, mode, sort, q: query === '' ? undefined : query })}
          // Lets the artist page's back link return through history, which restores the list's scroll position.
          state={(previous) => ({ ...previous, fromRanking: true })}
          tabIndex={tabIndex}
          aria-describedby={detailsId}
          className="block truncate text-base font-medium tracking-[-0.01em] text-text after:absolute after:inset-0 focus-visible:shadow-none"
        >
          {highlightParts(artist.name, query).map((part, index) =>
            part.match ? (
              // Keyed by position: the pieces are one name cut up, and they all change together when the query does.
              <mark key={`${index}-${part.text}`} className="bg-soft-highlight text-highlight">
                {part.text}
              </mark>
            ) : (
              part.text
            ),
          )}
        </Link>
        <span aria-hidden className="mt-1 block truncate text-sm text-subtle">
          {sample}
        </span>
      </span>
      <span aria-hidden className="text-right text-base tabular-nums">
        {countFormat.format(count)}
      </span>
      <span aria-hidden className="hidden items-center gap-2.5 min-[741px]:flex">
        <span className="h-1.25 flex-1 overflow-hidden rounded-full bg-raised-surface">
          <span
            data-slot="bar"
            className="block h-full rounded-full bg-accent"
            style={{ width: `${barWidthPercent(count, leaderCount)}%` }}
          />
        </span>
        <span className="w-9.5 shrink-0 text-right text-xs text-muted tabular-nums">{formatShare(share)}</span>
      </span>
      <span id={detailsId} hidden>
        {artistRowDetails(ranking, share, tied)}
      </span>
    </div>
  )
}
