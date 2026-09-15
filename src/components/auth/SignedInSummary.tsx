import { Link } from '@tanstack/react-router'
import { secondaryActionClass } from '../action-styles.ts'

export function SignedInSummary({ displayName, onSignOut }: { displayName: string; onSignOut: () => void }) {
  return (
    <div className="mt-6 grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3">
        <p className="font-semibold">{`Connected as ${displayName}`}</p>
        <button type="button" onClick={onSignOut} className={secondaryActionClass}>
          Sign out
        </button>
      </div>
      <p className="text-muted">Loading your liked songs comes next. Until then, explore the demo library.</p>
      <Link to="/demo" className={`${secondaryActionClass} justify-self-start`}>
        Explore the demo
      </Link>
    </div>
  )
}
