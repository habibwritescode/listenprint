import { Suspense, lazy } from 'react'
import { NotAllowlisted } from '../components/auth/NotAllowlisted.tsx'
import { SignedOutHome } from '../components/auth/SignedOutHome.tsx'
import { useAuth } from '../hooks/useAuth.ts'

// Everything a signed-in user sees reads the library through TanStack Query's observers and, once there's a ranking,
// the virtualizer. Loaded on demand so signed-out visitors, most of them, download none of it.
const SignedInHome = lazy(() =>
  import('../components/library/SignedInHome.tsx').then((module) => ({ default: module.SignedInHome })),
)

export function RankingsPage() {
  const { state, auth } = useAuth()

  switch (state.status) {
    case 'signedIn':
      return (
        <Suspense fallback={null}>
          <SignedInHome displayName={state.displayName} />
        </Suspense>
      )
    case 'notAllowlisted':
      return <NotAllowlisted onSignOut={() => auth.signOut()} />
    default:
      return <SignedOutHome state={state} auth={auth} />
  }
}
