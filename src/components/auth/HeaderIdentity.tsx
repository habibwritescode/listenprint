import { useMatchRoute } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth.ts'
import { ArtistAvatar } from '../artists/ArtistAvatar.tsx'

/** Who is connected, with Sign out, on the home page only: the demo pages never show a real account. */
export function HeaderIdentity() {
  const { state, auth } = useAuth()
  const onHome = useMatchRoute()({ to: '/' })
  if (!onHome || state.status !== 'signedIn') return null

  return (
    <div className="flex min-w-0 items-center gap-2.25">
      <ArtistAvatar name={state.displayName} size="identity" />
      <p className="min-w-0 truncate text-md text-muted">
        <span className="max-sm:sr-only">Connected as </span>
        <span className="text-text">{state.displayName}</span>
      </p>
      <button
        type="button"
        onClick={() => auth.signOut()}
        className="h-7 shrink-0 rounded-md border border-border px-2.75 text-sm text-muted transition-colors hover:text-text"
      >
        Sign out
      </button>
    </div>
  )
}
