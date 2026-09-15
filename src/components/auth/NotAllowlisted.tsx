import { Link } from '@tanstack/react-router'
import { primaryActionClass, secondaryActionClass } from '../action-styles.ts'

export function NotAllowlisted({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="mt-6 grid gap-4 rounded-md border border-border bg-surface p-5">
      <h2 className="text-xl font-bold tracking-tight">This Spotify account can't sign in yet</h2>
      <p className="text-muted">
        Listenprint is in Spotify's Development Mode, which only lets up to five invited accounts sign in. Your
        account isn't one of them. You can still explore everything with the demo library.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/demo" className={primaryActionClass}>
          Try the demo
        </Link>
        <button type="button" onClick={onSignOut} className={secondaryActionClass}>
          Sign out
        </button>
      </div>
    </div>
  )
}
