import type { ReactNode } from 'react'
import { genreBreakdown, hasEnoughGenreCoverage } from '../../library/genres.ts'
import type { ArtistGenres, GenreShare } from '../../library/genres.ts'
import type { LibraryTrack, RankingMode } from '../../library/types.ts'
import { BarChart } from './BarChart.tsx'
import type { ChartBar } from './BarChart.tsx'

interface GenresViewProps {
  tracks: readonly LibraryTrack[]
  genres: ArtistGenres
  mode: RankingMode
  /** One line under the heading, naming whose library this is. */
  subtitle: string
  /** Shown when too little of the library carries tags; the numbers are added to it. */
  unavailableBody: string
  /** Links out of the unavailable state. */
  unavailableActions: ReactNode
}

const countFormat = new Intl.NumberFormat()
const percentFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })

function toBar(genre: GenreShare): ChartBar {
  const songs = genre.tracks === 1 ? '1 song' : `${countFormat.format(genre.tracks)} songs`
  const artists = genre.artists === 1 ? '1 artist' : `${countFormat.format(genre.artists)} artists`
  return {
    key: genre.name,
    label: genre.name,
    value: genre.tracks,
    share: genre.share,
    name: `${genre.name}, ${songs}, ${percentFormat.format(genre.share * 100)}% of tagged songs, ${artists}`,
    readout: [
      { label: 'Songs', value: countFormat.format(genre.tracks) },
      { label: 'Artists', value: countFormat.format(genre.artists) },
      { label: 'Top artist', value: genre.topArtist },
    ],
  }
}

/** The genre breakdown for any library, with the coverage it was computed from stated before the chart. */
export function GenresView({ tracks, genres, mode, subtitle, unavailableBody, unavailableActions }: GenresViewProps) {
  const breakdown = genreBreakdown(tracks, genres, mode)
  const enough = hasEnoughGenreCoverage(breakdown.coverage)
  const untagged = breakdown.trackCount - breakdown.taggedTracks

  return (
    <section aria-labelledby="genres-title" className="space-y-5">
      <div>
        <h1 id="genres-title" className="text-2xl font-bold tracking-[-0.025em]">
          Genre breakdown
        </h1>
        <p className="mt-2 max-w-[64ch] text-base text-muted">{subtitle}</p>
      </div>

      {enough ? (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
          {breakdown.coverage < 1 && (
            <p className="grid grid-cols-[8px_minmax(0,1fr)] items-start gap-2.75 rounded-md bg-background px-3.75 py-3.25 text-md leading-[1.55] text-muted">
              <span aria-hidden className="mt-1.5 size-1.75 rounded-full bg-highlight" />
              {`Only ${Math.round(breakdown.coverage * 100)}% of these songs have an artist with genre tags. ` +
                'The shares below are out of tagged songs, not the whole library.'}
            </p>
          )}
          <p className="text-2xs tracking-[0.12em] text-subtle uppercase tabular-nums">
            Top genres · share of tagged songs
          </p>
          <BarChart label="Top genres" layout="rows" bars={breakdown.genres.map(toBar)} valueSuffix="songs" />
          <p className="text-sm text-subtle">Charts load only when you open this view.</p>
        </div>
      ) : (
        <div className="space-y-3.5 rounded-lg border border-border bg-surface px-4 py-6 text-center sm:px-5">
          <h2 className="text-lg font-semibold">Genre data unavailable</h2>
          <p className="mx-auto max-w-[64ch] text-base text-muted">
            {`${unavailableBody} They came back empty for ${countFormat.format(untagged)} of ` +
              `${countFormat.format(breakdown.trackCount)} songs, which leaves too little to rank fairly.`}
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">{unavailableActions}</div>
        </div>
      )}
    </section>
  )
}
