import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { GenresView } from '../components/analytics/GenresView.tsx'
import { ghostActionClass, primaryActionClass } from '../components/action-styles.ts'
import { demoGenresQueryOptions, demoLibraryQueryOptions } from '../demo/demo-library-query.ts'

const route = getRouteApi('/demo/genres')

export function DemoGenresPage() {
  const { mode, sort } = route.useSearch()
  const { data: library } = useSuspenseQuery(demoLibraryQueryOptions)
  const { data: genres } = useSuspenseQuery(demoGenresQueryOptions)

  return (
    <GenresView
      tracks={library.tracks}
      genres={genres}
      mode={mode}
      subtitle={
        mode === 'primary'
          ? 'Genres come from artist-level tags, attributed through the primary artist on each song.'
          : 'Genres come from artist-level tags, attributed through every artist on a song.'
      }
      unavailableBody="The sample artists carry genre tags of their own."
      unavailableActions={
        <>
          <Link to="/demo" search={{ mode, sort }} className={primaryActionClass}>
            Back to ranking
          </Link>
          <Link to="/demo/timeline" search={{ mode, sort, grain: 'month' }} className={ghostActionClass}>
            View timeline instead
          </Link>
        </>
      }
    />
  )
}
