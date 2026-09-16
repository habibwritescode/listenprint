import { NotAllowlisted } from '../components/auth/NotAllowlisted.tsx'
import { SignedInSummary } from '../components/auth/SignedInSummary.tsx'
import { SignedOutHome } from '../components/auth/SignedOutHome.tsx'
import { useAuth } from '../hooks/useAuth.ts'

export function RankingsPage() {
  const { state, auth } = useAuth()

  switch (state.status) {
    case 'signedIn':
      return <SignedInSummary displayName={state.displayName} />
    case 'notAllowlisted':
      return <NotAllowlisted onSignOut={() => auth.signOut()} />
    default:
      return <SignedOutHome state={state} auth={auth} />
  }
}
