import { primaryActionClass } from '../action-styles.ts'

interface ConnectSpotifyButtonProps {
  /** True while leaving for Spotify. */
  busy: boolean
  label?: string
  onConnect: () => void
}

export function ConnectSpotifyButton({ busy, label = 'Connect Spotify', onConnect }: ConnectSpotifyButtonProps) {
  return (
    <button type="button" disabled={busy} onClick={onConnect} className={primaryActionClass}>
      {busy ? 'Opening Spotify…' : label}
    </button>
  )
}
