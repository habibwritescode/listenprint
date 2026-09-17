import { Link, getRouteApi } from '@tanstack/react-router'
import { TimelineView } from '../components/analytics/TimelineView.tsx'
import { ghostActionClass, primaryActionClass } from '../components/action-styles.ts'
import { LiveAnalytics, SignedOutAnalytics } from '../components/library/LiveAnalytics.tsx'
import { useAuth } from '../hooks/useAuth.ts'

const route = getRouteApi('/timeline')

function LiveTimeline() {
  const { mode, sort, grain } = route.useSearch()

  return (
    <LiveAnalytics verb="chart">
      {(library) => (
        <TimelineView
          tracks={library.tracks}
          grain={grain}
          subtitle={
            grain === 'year'
              ? 'Every track you have liked, counted by the year you saved it.'
              : 'Every track you have liked, counted by the month you saved it.'
          }
          sparseBody={
            'Your liked songs cover less than a year. Listenprint needs about that long before the shape of a habit ' +
            'means anything — until then, a few bars is a few bars.'
          }
          sparseActions={
            <>
              <Link to="/" search={{ mode, sort }} className={primaryActionClass}>
                See your artist ranking
              </Link>
              <Link to="/demo/timeline" search={{ grain: 'month' }} className={ghostActionClass}>
                See the sample timeline
              </Link>
            </>
          }
        />
      )}
    </LiveAnalytics>
  )
}

export function TimelinePage() {
  const { state } = useAuth()
  return state.status === 'signedIn' ? <LiveTimeline /> : <SignedOutAnalytics verb="chart" />
}
