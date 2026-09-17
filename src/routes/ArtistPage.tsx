import { Link } from '@tanstack/react-router'
import { Notice } from '../components/Notice.tsx'
import { ghostActionClass, primaryActionClass } from '../components/action-styles.ts'
import { LiveArtist } from '../components/library/LiveArtist.tsx'
import { useAuth } from '../hooks/useAuth.ts'

export function ArtistPage() {
  const { state } = useAuth()

  if (state.status !== 'signedIn') {
    return (
      <Notice
        tone="neutral"
        kicker="Signed out"
        title="This page needs your Spotify library."
        body="Artist pages come from the library saved in this browser, and there’s nothing saved while you’re signed out. Connect Spotify on the home page, or look around the sample library."
      >
        <Link to="/" className={primaryActionClass}>
          Go to the home page
        </Link>
        <Link to="/demo" className={ghostActionClass}>
          Open the demo
        </Link>
      </Notice>
    )
  }

  return <LiveArtist />
}
