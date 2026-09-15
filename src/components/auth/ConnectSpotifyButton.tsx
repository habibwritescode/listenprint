import { primaryActionClass } from '../action-styles.ts'

interface ConnectSpotifyButtonProps {
  /** The page's full URL, used to spot localhost. */
  currentUrl: string
  /** True while leaving for Spotify. */
  busy: boolean
  label?: string
  onConnect: () => void
}

// Spotify rejects localhost redirect URIs, so a sign-in started there could never come back.
function loopbackUrl(currentUrl: string): string | null {
  const url = new URL(currentUrl)
  if (url.hostname !== 'localhost') return null
  url.hostname = '127.0.0.1'
  return url.href
}

export function ConnectSpotifyButton({ currentUrl, busy, label = 'Connect Spotify', onConnect }: ConnectSpotifyButtonProps) {
  const loopback = loopbackUrl(currentUrl)
  if (loopback) {
    return (
      <p className="text-muted">
        Spotify doesn't accept sign-ins from localhost.{' '}
        <a href={loopback} className="font-medium text-accent hover:text-accent-bright">
          Open on 127.0.0.1
        </a>
      </p>
    )
  }

  return (
    <button type="button" disabled={busy} onClick={onConnect} className={primaryActionClass}>
      {busy ? 'Opening Spotify…' : label}
    </button>
  )
}
