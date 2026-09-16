import { Link } from '@tanstack/react-router'
import type { SignedOutNotice } from '../../auth/auth-machine.ts'
import { Notice } from '../Notice.tsx'
import type { NoticeTone } from '../Notice.tsx'
import { ghostActionClass, softActionClass } from '../action-styles.ts'
import { ConnectSpotifyButton } from './ConnectSpotifyButton.tsx'

export type AuthNoticeKind = SignedOutNotice | 'unreachable'

interface NoticeCopy {
  tone: NoticeTone
  kicker: string
  title: string
  body: string
  detail?: string
  action: string
  /** Soft when the demo is an equal choice, ghost when retrying is the point of the screen. */
  demoClass: string
}

const COPY: Record<AuthNoticeKind, NoticeCopy> = {
  cancelled: {
    tone: 'neutral',
    kicker: 'Sign-in stopped',
    title: 'You cancelled the Spotify sign-in.',
    body: 'Nothing was connected and no data was read. You can start over, or look around the sample library first.',
    action: 'Connect Spotify',
    demoClass: softActionClass,
  },
  unverified: {
    tone: 'attention',
    kicker: 'Verification failed',
    title: 'That sign-in couldn’t be verified.',
    body: 'Spotify’s response didn’t match a sign-in this browser started, or Spotify turned it down, so it was discarded rather than trusted. This usually means sign-in finished in a different browser or tab, or the same sign-in link was opened twice.',
    detail: 'Sign-in discarded · nothing was saved',
    action: 'Start sign-in again',
    demoClass: ghostActionClass,
  },
  // Refresh tokens end six months after sign-in, or when access is revoked; a transient failure never lands here.
  expired: {
    tone: 'neutral',
    kicker: 'Session ended',
    title: 'Your Spotify session ended.',
    body: 'Your Spotify sign-in has expired or was revoked, so Listenprint can’t read your library any more. Reconnecting takes a few seconds.',
    action: 'Reconnect Spotify',
    demoClass: ghostActionClass,
  },
  unreachable: {
    tone: 'attention',
    kicker: 'Network',
    title: 'Couldn’t reach Spotify.',
    body: 'The request failed before a session could be created. This is usually a dropped connection or a blocked request, not a problem with your account.',
    action: 'Try again',
    demoClass: ghostActionClass,
  },
}

interface AuthNoticeProps {
  kind: AuthNoticeKind
  busy: boolean
  onConnect: () => void
}

export function AuthNotice({ kind, busy, onConnect }: AuthNoticeProps) {
  const { action, demoClass, ...copy } = COPY[kind]

  return (
    <Notice {...copy}>
      <ConnectSpotifyButton busy={busy} label={action} onConnect={onConnect} />
      <Link to="/demo" className={demoClass}>
        Try the demo
      </Link>
    </Notice>
  )
}
