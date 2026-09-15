// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectSpotifyButton } from './ConnectSpotifyButton.tsx'

afterEach(cleanup)

describe('ConnectSpotifyButton', () => {
  it('calls onConnect when clicked', async () => {
    const user = userEvent.setup()
    const onConnect = vi.fn()
    render(<ConnectSpotifyButton currentUrl="https://listenprint.vercel.app/" busy={false} onConnect={onConnect} />)

    await user.click(screen.getByRole('button', { name: 'Connect Spotify' }))

    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  it('uses a custom label', () => {
    render(<ConnectSpotifyButton currentUrl="http://127.0.0.1:5173/" busy={false} label="Try again" onConnect={() => {}} />)

    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
  })

  it('is disabled while leaving for Spotify', () => {
    render(<ConnectSpotifyButton currentUrl="http://127.0.0.1:5173/" busy onConnect={() => {}} />)

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Opening Spotify…' }).disabled).toBe(true)
  })

  // Spotify rejects localhost redirect URIs, so a sign-in from there could never come back.
  it('points localhost to the same page on 127.0.0.1 instead of offering a sign-in that would fail', () => {
    render(<ConnectSpotifyButton currentUrl="http://localhost:5173/demo?mode=primary" busy={false} onConnect={() => {}} />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/Spotify doesn't accept sign-ins from localhost/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'Open on 127.0.0.1' }).getAttribute('href')).toBe(
      'http://127.0.0.1:5173/demo?mode=primary',
    )
  })
})
