import { Link } from '@tanstack/react-router'
import { Notice } from '../Notice.tsx'
import { ghostActionClass, primaryActionClass } from '../action-styles.ts'

// The most common dead end for real visitors, so the demo is the primary action.
export function NotAllowlisted({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Notice
      align="start"
      tone="attention"
      kicker="Development mode"
      title="This Spotify account can’t sign in yet."
      body="Spotify keeps this app in development mode, which allows exactly five invited accounts. Yours isn’t one of them — that’s a limit on this app, not on your account."
      body2="The demo runs the same interface over a 10,000-track sample library, so you can still see everything Listenprint does."
      detail="Spotify: this account isn’t on the app’s list"
    >
      <Link to="/demo" className={primaryActionClass}>
        Explore the demo
      </Link>
      <button type="button" onClick={onSignOut} className={ghostActionClass}>
        Sign out
      </button>
    </Notice>
  )
}
