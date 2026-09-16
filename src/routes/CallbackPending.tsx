import { Notice } from '../components/Notice.tsx'

export function CallbackPending() {
  return (
    <Notice
      role="status"
      spinner
      title="Connecting to Spotify…"
      body="Verifying the response and exchanging it for a session. This happens entirely in your browser."
      meta="Step 2 of 3 · your library hasn’t been read yet"
    />
  )
}
