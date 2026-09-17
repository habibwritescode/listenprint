import { Link } from '@tanstack/react-router'
import { coOccurringArtists } from '../../library/co-occurrence.ts'
import type { SortOrder } from '../../library/presentation.ts'
import type { LibraryTrack, RankingMode } from '../../library/types.ts'
import { ArtistAvatar } from './ArtistAvatar.tsx'
import { artistPath } from './library-paths.ts'
import type { LibraryBase } from './library-paths.ts'

interface CoOccurringArtistsProps {
  tracks: readonly LibraryTrack[]
  artistId: string
  artistName: string
  mode: RankingMode
  sort: SortOrder
  basePath: LibraryBase
}

const countFormat = new Intl.NumberFormat()
const shareFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })

const ROW_GRID = 'grid grid-cols-[28px_40px_minmax(0,1fr)_72px_84px] items-center gap-3 px-4'

/** Who else turns up on this artist's liked songs: the ranked table the spec asks for, per artist. */
export function CoOccurringArtists({ tracks, artistId, artistName, mode, sort, basePath }: CoOccurringArtistsProps) {
  const entries = coOccurringArtists(tracks, artistId, mode)

  return (
    <section aria-labelledby="co-occurring-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="co-occurring-title" className="text-lg font-semibold">
          Co-occurring artists
        </h2>
        <p className="text-sm text-subtle">Ranked by liked songs they share</p>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-3.5 text-base text-muted">
          {`No other artist is credited on ${artistName}’s liked songs.`}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div
            aria-hidden
            className={`h-9 border-b border-border text-2xs tracking-[0.12em] text-subtle uppercase ${ROW_GRID}`}
          >
            <span>#</span>
            <span />
            <span>Artist</span>
            <span className="text-right">Shared</span>
            <span className="text-right">Of theirs</span>
          </div>
          <ol>
            {entries.map((entry, index) => (
              <li key={entry.artist.id} className={`h-15 border-b border-border last:border-b-0 ${ROW_GRID}`}>
                <span aria-hidden className="text-md text-subtle tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <ArtistAvatar name={entry.artist.name} size="art" />
                <Link
                  to={artistPath(basePath)}
                  params={{ artistId: entry.artist.id }}
                  search={{ mode, sort }}
                  aria-describedby={`co-occurring-${entry.artist.id}`}
                  className="truncate text-base text-text"
                >
                  {entry.artist.name}
                </Link>
                <span aria-hidden className="text-right text-base tabular-nums">
                  {countFormat.format(entry.shared)}
                </span>
                <span aria-hidden className="text-right text-base text-muted tabular-nums">
                  {shareFormat.format(entry.shareOfTheirs)}
                </span>
                <span id={`co-occurring-${entry.artist.id}`} hidden>
                  {`${countFormat.format(entry.shared)} shared liked songs, ` +
                    `${shareFormat.format(entry.shareOfTheirs)} of theirs`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
