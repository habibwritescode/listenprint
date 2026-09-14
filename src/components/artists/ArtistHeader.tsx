import { Link } from '@tanstack/react-router'
import type { ArtistRanking, ArtistRef, RankingMode } from '../../library/types.ts'
import { ArtistAvatar } from './ArtistAvatar.tsx'

interface ArtistHeaderProps {
  artist: ArtistRef
  /** `null` when the artist has no counted tracks in `mode`, e.g. a featured-only artist in `primary`. */
  ranking: ArtistRanking | null
  mode: RankingMode
  spotifyUrl: string | null
}

const countFormat = new Intl.NumberFormat()

const actionClass =
  'rounded-sm border border-border px-3 py-2 text-sm font-semibold text-text transition-colors hover:border-accent hover:text-accent'

export function ArtistHeader({ artist, ranking, mode, spotifyUrl }: ArtistHeaderProps) {
  return (
    <header className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/demo" search={{ mode }} className={actionClass}>
          Back to rankings
        </Link>
        {spotifyUrl && (
          <a href={spotifyUrl} target="_blank" rel="noreferrer" className={actionClass}>
            Open in Spotify
          </a>
        )}
      </div>

      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3.5">
        <ArtistAvatar name={artist.name} size="header" />
        <div className="min-w-0">
          {ranking && (
            <p className="mb-2 text-[0.78rem] font-extrabold text-subtle uppercase tabular-nums">
              {`#${ranking.rank} · ${countFormat.format(ranking.count)} liked ${ranking.count === 1 ? 'song' : 'songs'}`}
            </p>
          )}
          <h1 id="artist-title" className="text-3xl font-bold tracking-tight wrap-break-word">
            {artist.name}
          </h1>
        </div>
      </div>

      {!ranking && (
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-muted">
            {artist.name} is only credited as a featured artist, so they aren't ranked when counting primary
            artists only.
          </p>
          <Link
            to="/demo/artist/$artistId"
            params={{ artistId: artist.id }}
            search={{ mode: 'all' }}
            className="mt-3 inline-block font-medium text-accent hover:text-accent-bright"
          >
            Count every credited artist
          </Link>
        </div>
      )}
    </header>
  )
}
