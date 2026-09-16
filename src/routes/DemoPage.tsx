import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { RankedArtistList } from '../components/artists/RankedArtistList.tsx'
import { StatsSummary } from '../components/artists/StatsSummary.tsx'
import { demoLibraryQueryOptions } from '../demo/demo-library-query.ts'
import { libraryStats, sortRankings } from '../library/presentation.ts'
import { rankArtists } from '../library/rankings.ts'

const route = getRouteApi('/demo')

const countFormat = new Intl.NumberFormat()

const SAMPLE_NOTES = { tracks: 'Sample library · the same for everyone', artists: 'Made-up artists, not on Spotify' }

export function DemoPage() {
  const { mode, sort } = route.useSearch()
  const { data: library } = useSuspenseQuery(demoLibraryQueryOptions)
  const rankings = rankArtists(library.tracks, mode)
  const stats = libraryStats(rankings, library.tracks)

  return (
    <section aria-labelledby="demo-title" className="space-y-4">
      <h1 id="demo-title" className="sr-only">
        Sample library ranking
      </h1>
      <StatsSummary rankings={rankings} trackCount={library.tracks.length} notes={SAMPLE_NOTES} />
      <RankedArtistList
        rankings={sortRankings(rankings, sort)}
        leaderCount={stats.leaderCount}
        trackCount={library.tracks.length}
        mode={mode}
        sort={sort}
        label={
          sort === 'alpha'
            ? `${countFormat.format(rankings.length)} artists, A to Z`
            : `${countFormat.format(rankings.length)} artists in the sample library`
        }
      />
      {/* The chip is for a glance; this states the dataset in full. */}
      <p className="grid grid-cols-[8px_minmax(0,1fr)] items-start gap-2.75 rounded-md border border-border bg-surface px-3.75 py-3.25 text-md leading-[1.55] text-muted">
        <span aria-hidden className="mt-1.5 size-1.75 rounded-full bg-highlight" />
        {`Sample library: ${countFormat.format(library.tracks.length)} tracks by fictional artists, generated ` +
          'from a fixed seed. No Spotify account is connected and nothing here reflects a real listening history.'}
      </p>
    </section>
  )
}
