import { Link, getRouteApi } from '@tanstack/react-router'
import { GenresView } from '../components/analytics/GenresView.tsx'
import { ghostActionClass, primaryActionClass } from '../components/action-styles.ts'
import { LiveAnalytics, SignedOutAnalytics } from '../components/library/LiveAnalytics.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useLibrary } from '../hooks/useLibrary.ts'
import { savedArtistGenres } from '../spotify/artist-genres.ts'

const route = getRouteApi('/genres')

function LiveGenres() {
  const { mode, sort } = route.useSearch()
  const { details } = useLibrary()

  return (
    <LiveAnalytics verb="break down">
      {(library) => (
        <GenresView
          tracks={library.tracks}
          genres={savedArtistGenres(details.data)}
          mode={mode}
          subtitle={
            mode === 'primary'
              ? 'Genres come from Spotify’s artist tags, attributed through the primary artist on each song.'
              : 'Genres come from Spotify’s artist tags, attributed through every artist on a song.'
          }
          unavailableBody="Spotify has stopped returning genre tags for most artists, and only your top 50 are looked up."
          unavailableActions={
            <>
              <Link to="/" search={{ mode, sort }} className={primaryActionClass}>
                Back to ranking
              </Link>
              <Link to="/timeline" search={{ mode, sort, grain: 'month' }} className={ghostActionClass}>
                View timeline instead
              </Link>
            </>
          }
        />
      )}
    </LiveAnalytics>
  )
}

export function GenresPage() {
  const { state } = useAuth()
  return state.status === 'signedIn' ? <LiveGenres /> : <SignedOutAnalytics verb="break down" />
}
