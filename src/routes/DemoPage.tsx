import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { RankedArtistList } from '../components/artists/RankedArtistList.tsx'
import { StatsSummary } from '../components/artists/StatsSummary.tsx'
import { demoLibraryQueryOptions } from '../demo/demo-library-query.ts'
import { libraryStats } from '../library/presentation.ts'
import { rankArtists } from '../library/rankings.ts'

const route = getRouteApi('/demo')

export function DemoPage() {
  const { mode } = route.useSearch()
  const { data: library } = useSuspenseQuery(demoLibraryQueryOptions)
  const rankings = rankArtists(library.tracks, mode)
  const stats = libraryStats(rankings, library.tracks)

  return (
    <section aria-labelledby="demo-title" className="space-y-8">
      <header>
        <h1 id="demo-title" className="text-3xl font-bold tracking-tight">
          Demo library
        </h1>
        <p className="mt-2 text-muted">
          A generated library of fictional artists, so you can explore Listenprint without a Spotify account.
        </p>
      </header>
      <StatsSummary stats={stats} />
      <RankedArtistList rankings={rankings} leaderCount={stats.leaderCount} mode={mode} />
    </section>
  )
}
