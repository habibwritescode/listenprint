export type AuthNoticeKind = 'cancelled' | 'unverified' | 'expired' | 'unreachable'

const MESSAGES: Record<AuthNoticeKind, string> = {
  cancelled: 'Spotify sign-in was cancelled.',
  unverified: "We couldn't verify that sign-in. Please try again.",
  expired: 'Your Spotify session has ended. Connect again to continue.',
  unreachable: "We couldn't reach Spotify to finish signing in.",
}

export function AuthNotice({ kind }: { kind: AuthNoticeKind }) {
  return (
    <p role="status" className="rounded-md border border-border bg-surface px-4 py-3 text-text">
      {MESSAGES[kind]}
    </p>
  )
}
