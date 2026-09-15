import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { AuthState } from '../auth/auth-machine.ts'
import type { AuthSession } from '../auth/session.ts'
import { secondaryActionClass } from '../components/action-styles.ts'
import { AuthNotice } from '../components/auth/AuthNotice.tsx'
import type { AuthNoticeKind } from '../components/auth/AuthNotice.tsx'
import { ConnectSpotifyButton } from '../components/auth/ConnectSpotifyButton.tsx'
import { NotAllowlisted } from '../components/auth/NotAllowlisted.tsx'
import { SignedInSummary } from '../components/auth/SignedInSummary.tsx'
import { useAuth } from '../hooks/useAuth.ts'

type SignedOutState = Exclude<AuthState, { status: 'signedIn' } | { status: 'notAllowlisted' }>

function noticeKind(state: SignedOutState): AuthNoticeKind | null {
  if (state.status === 'error') return 'unreachable'
  return state.status === 'signedOut' ? (state.notice ?? null) : null
}

function SignedOutIntro({ state, auth }: { state: SignedOutState; auth: AuthSession }) {
  const [startFailed, setStartFailed] = useState(false)
  const notice = noticeKind(state)

  const connect = () => {
    setStartFailed(false)
    // Rejects before leaving the page when the browser blocks storing the sign-in attempt.
    auth.startSignIn().catch(() => setStartFailed(true))
  }

  return (
    <>
      <p className="mt-3 text-muted">
        Listenprint ranks the artists in your Spotify Liked Songs by how many of their songs you've saved, and
        shows which songs put them there.
      </p>
      <p className="mt-2 text-muted">Connect your Spotify account, or explore a generated library of fictional artists.</p>
      {notice && (
        <div className="mt-6">
          <AuthNotice kind={notice} />
        </div>
      )}
      {startFailed && (
        <p role="alert" className="mt-6 rounded-md border border-border bg-surface px-4 py-3 text-text">
          Couldn't start Spotify sign-in. Sign-in needs this site to be allowed to store data.
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ConnectSpotifyButton
          currentUrl={window.location.href}
          busy={state.status === 'redirecting' || state.status === 'completing'}
          label={state.status === 'error' ? 'Try again' : undefined}
          onConnect={connect}
        />
        <Link to="/demo" className={secondaryActionClass}>
          Try the demo
        </Link>
      </div>
    </>
  )
}

function RankingsBody({ state, auth }: { state: AuthState; auth: AuthSession }) {
  switch (state.status) {
    case 'signedIn':
      return <SignedInSummary displayName={state.displayName} onSignOut={() => auth.signOut()} />
    case 'notAllowlisted':
      return <NotAllowlisted onSignOut={() => auth.signOut()} />
    default:
      return <SignedOutIntro state={state} auth={auth} />
  }
}

export function RankingsPage() {
  const { state, auth } = useAuth()

  return (
    <section aria-labelledby="rankings-title" className="max-w-2xl">
      <h1 id="rankings-title" className="text-3xl font-bold tracking-tight">
        Your artist rankings
      </h1>
      <RankingsBody state={state} auth={auth} />
    </section>
  )
}
