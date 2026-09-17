import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { TimelineView } from '../components/analytics/TimelineView.tsx'
import { primaryActionClass } from '../components/action-styles.ts'
import { demoLibraryQueryOptions } from '../demo/demo-library-query.ts'

const route = getRouteApi('/demo/timeline')

export function DemoTimelinePage() {
  const { mode, sort, grain } = route.useSearch()
  const { data: library } = useSuspenseQuery(demoLibraryQueryOptions)

  return (
    <TimelineView
      tracks={library.tracks}
      grain={grain}
      subtitle={
        grain === 'year'
          ? 'Every track in the sample library, counted by the year it was saved.'
          : 'Every track in the sample library, counted by the month it was saved.'
      }
      sparseBody={
        'The sample library covers less than a year, so there is no shape to read yet — until then, a few bars is ' +
        'a few bars.'
      }
      sparseActions={
        <Link to="/demo" search={{ mode, sort }} className={primaryActionClass}>
          See the artist ranking
        </Link>
      }
    />
  )
}
