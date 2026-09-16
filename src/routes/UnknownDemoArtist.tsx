import { Link, getRouteApi, useLocation } from '@tanstack/react-router'
import { Notice } from '../components/Notice.tsx'
import { primaryActionClass } from '../components/action-styles.ts'

const route = getRouteApi('/demo/artist/$artistId')

export function UnknownDemoArtist() {
  const { pathname } = useLocation()
  const search = route.useSearch()

  return (
    <Notice
      tone="neutral"
      kicker="Not in this library"
      title="That artist isn’t in the sample library."
      body="The id in the address doesn’t match any artist in the sample library, which is the same for everyone. It may be an artist from a real Spotify library, or a mistyped address."
      detail={pathname}
    >
      <Link to="/demo" search={search} className={primaryActionClass}>
        Back to ranking
      </Link>
    </Notice>
  )
}
