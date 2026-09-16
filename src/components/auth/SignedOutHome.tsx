import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { AuthState } from '../../auth/auth-machine.ts'
import { loopbackUrl } from '../../auth/config.ts'
import type { AuthSession } from '../../auth/session.ts'
import { Notice } from '../Notice.tsx'
import { ghostActionClass, primaryActionClass, softActionClass } from '../action-styles.ts'
import { AuthNotice } from './AuthNotice.tsx'
import type { AuthNoticeKind } from './AuthNotice.tsx'
import { ConnectSpotifyButton } from './ConnectSpotifyButton.tsx'

export type SignedOutState = Exclude<AuthState, { status: 'signedIn' } | { status: 'notAllowlisted' }>

function noticeKind(state: SignedOutState): AuthNoticeKind | null {
  if (state.status === 'error') return 'unreachable'
  return state.status === 'signedOut' ? (state.notice ?? null) : null
}

interface SignedOutHomeProps {
  state: SignedOutState
  auth: AuthSession
}

export function SignedOutHome({ state, auth }: SignedOutHomeProps) {
  const [startFailed, setStartFailed] = useState(false)
  // Leaving for Spotify clears the notice from auth state, but the screen it was started from stays up meanwhile.
  const [startedFrom, setStartedFrom] = useState<AuthNoticeKind | null>(null)
  const busy = state.status === 'redirecting' || state.status === 'completing'
  const kind = state.status === 'redirecting' ? startedFrom : noticeKind(state)

  const connect = () => {
    setStartFailed(false)
    setStartedFrom(kind)
    // Rejects before leaving the page when the browser blocks storing the sign-in attempt.
    auth.startSignIn().catch(() => setStartFailed(true))
  }

  const loopback = loopbackUrl(window.location.href)
  if (loopback) return <LocalhostNotice loopback={loopback} />
  if (startFailed) return <StorageBlockedNotice onRetry={connect} />
  if (kind) return <AuthNotice kind={kind} busy={busy} onConnect={connect} />

  return (
    <Notice
      hero
      align="start"
      tone="product"
      kicker="Client-side Spotify analytics"
      title="See which artists actually own your library."
      body="Listenprint reads your Liked Songs in the browser, ranks every artist behind them, and shows how concentrated your taste really is. There’s no Listenprint server: your library goes from Spotify to this tab and nowhere else."
      body2="Spotify sign-in is currently limited to five invited accounts while the app is in development mode. The demo is the full product on a sample library."
    >
      <ConnectSpotifyButton busy={busy} onConnect={connect} />
      <Link to="/demo" className={softActionClass}>
        Try the demo
      </Link>
    </Notice>
  )
}

function StorageBlockedNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <Notice
      align="start"
      tone="attention"
      kicker="Browser setting"
      title="This browser is blocking site storage."
      body="Listenprint needs site storage to remember a sign-in while you’re on Spotify’s page, and to keep you signed in afterwards. With storage blocked, sign-in can’t complete."
      body2="Private windows and strict tracking-protection modes are the usual cause. The demo needs no storage at all and works as-is."
      detail="Storage blocked for this site"
    >
      <Link to="/demo" className={primaryActionClass}>
        Try the demo
      </Link>
      <button type="button" onClick={onRetry} className={ghostActionClass}>
        Try again
      </button>
    </Notice>
  )
}

// Also shown in production builds: `pnpm preview` serves one, and sign-in from localhost fails there too.
function LocalhostNotice({ loopback }: { loopback: string }) {
  return (
    <Notice
      align="start"
      tone="neutral"
      kicker="Development build only"
      title="Open this app on 127.0.0.1."
      body="Spotify no longer accepts localhost as a redirect address. The registered redirect URIs use 127.0.0.1, so a sign-in started from localhost can’t come back."
      detail={`→ ${loopback}`}
    >
      <a href={loopback} className={primaryActionClass}>
        Open on 127.0.0.1
      </a>
      <Link to="/demo" className={ghostActionClass}>
        Continue to demo
      </Link>
    </Notice>
  )
}
