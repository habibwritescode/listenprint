import { Link } from '@tanstack/react-router'
import { Notice } from '../Notice.tsx'
import { softActionClass } from '../action-styles.ts'

// Sign out lives in the header, where it stays once the live ranking replaces this notice.
export function SignedInSummary({ displayName }: { displayName: string }) {
  return (
    <Notice
      align="start"
      tone="neutral"
      kicker="Ready"
      title={`Connected as ${displayName}.`}
      body="Your live ranking arrives in a later release, so nothing from your library has been read yet. Until then, the demo shows everything Listenprint does on a 10,000-track sample library."
    >
      <Link to="/demo" className={softActionClass}>
        Try the demo
      </Link>
    </Notice>
  )
}
