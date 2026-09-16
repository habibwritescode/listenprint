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
    render(<ConnectSpotifyButton busy={false} onConnect={onConnect} />)

    await user.click(screen.getByRole('button', { name: 'Connect Spotify' }))

    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  it('uses a custom label', () => {
    render(<ConnectSpotifyButton busy={false} label="Try again" onConnect={() => {}} />)

    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
  })

  it('is disabled while leaving for Spotify', () => {
    render(<ConnectSpotifyButton busy onConnect={() => {}} />)

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Opening Spotify…' }).disabled).toBe(true)
  })
})
