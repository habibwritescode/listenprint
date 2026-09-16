import { Link } from '@tanstack/react-router'
import { barWidthPercent } from '../../library/presentation.ts'
import type { ArtistRanking, RankingMode } from '../../library/types.ts'
import { ArtistAvatar } from './ArtistAvatar.tsx'

interface ArtistRowProps {
  ranking: ArtistRanking
  leaderCount: number
  mode: RankingMode
  /** 0 for the list's single Tab stop, -1 for every other row. */
  tabIndex: number
}

export function ArtistRow({ ranking, leaderCount, mode, tabIndex }: ArtistRowProps) {
  const { artist, rank, count, tracks } = ranking
  const label = `Rank ${rank}, ${artist.name}, ${count} liked ${count === 1 ? 'song' : 'songs'}`
  const sample = tracks
    .slice(0, 3)
    .map((track) => track.name)
    .join(' • ')

  return (
    <Link
      to="/demo/artist/$artistId"
      params={{ artistId: artist.id }}
      search={{ mode }}
      tabIndex={tabIndex}
      className="group relative isolate grid h-full grid-cols-[42px_minmax(0,1fr)_64px] items-center gap-4 px-3 py-2.5 focus-visible:-outline-offset-2 min-[741px]:grid-cols-[68px_minmax(0,1fr)_112px] min-[741px]:px-4.5"
    >
      {/* One text node: spaces at the edges of separate screen-reader-only spans get trimmed. */}
      <span className="sr-only">{label}</span>
      <span
        data-slot="bar"
        aria-hidden
        className="absolute inset-y-0 left-0 -z-10 bg-linear-to-r from-accent/24 to-accent/0"
        style={{ width: `${barWidthPercent(count, leaderCount)}%` }}
      />
      <span aria-hidden className="text-[1.1rem] font-black text-subtle tabular-nums">
        {rank}
      </span>
      <span
        aria-hidden
        className="grid min-w-0 grid-cols-[42px_minmax(0,1fr)] items-center gap-3 min-[741px]:grid-cols-[48px_minmax(0,1fr)]"
      >
        <ArtistAvatar name={artist.name} />
        <span className="grid min-w-0 gap-1">
          <strong className="truncate text-[1.02rem] font-bold text-text group-hover:text-bright-accent group-focus-visible:text-bright-accent">
            {artist.name}
          </strong>
          <small className="truncate text-sm text-muted">{sample}</small>
        </span>
      </span>
      <span aria-hidden className="justify-self-end text-base font-black tabular-nums min-[741px]:text-[1.18rem]">
        {count}
      </span>
    </Link>
  )
}
