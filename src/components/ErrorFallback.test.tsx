// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from '../test/axe.ts'
import { ErrorFallback } from './ErrorFallback.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function crash() {
  const error = new TypeError('rows[i] is undefined')
  error.stack = 'TypeError: rows[i] is undefined\n    at RankedArtistList'
  return error
}

describe('ErrorFallback', () => {
  it('takes the blame, shows the error, and offers a way out', async () => {
    const { container } = render(<ErrorFallback error={crash()} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Listenprint hit an error and stopped.' })).toBeDefined()
    expect(screen.getByText('Something broke').dataset.tone).toBe('attention')
    expect(screen.getByText('TypeError: rows[i] is undefined')).toBeDefined()
    // A plain anchor: this screen can render outside the router.
    expect(screen.getByRole('link', { name: 'Open the demo' }).getAttribute('href')).toBe('/demo')
    await expectNoAxeViolations(container)
  })

  it('shows a thrown value that is not an Error', () => {
    render(<ErrorFallback error="lost connection" />)

    expect(screen.getByText('lost connection')).toBeDefined()
  })

  it('reloads the app', async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload, pathname: '/demo' })
    render(<ErrorFallback error={crash()} />)

    await user.click(screen.getByRole('button', { name: 'Reload the app' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('copies the error details, with the stack and page but no query string, and confirms it', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('location', { ...window.location, pathname: '/callback', search: '?code=secret' })
    render(<ErrorFallback error={crash()} />)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    await user.click(screen.getByRole('button', { name: 'Copy error details' }))

    expect(writeText).toHaveBeenCalledWith(
      'TypeError: rows[i] is undefined\n    at RankedArtistList\n\nPage: /callback',
    )
    expect((await screen.findByRole('status')).textContent).toBe('Error details copied.')
  })

  it('says so when copying is refused', async () => {
    const user = userEvent.setup()
    render(<ErrorFallback error={crash()} />)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) },
      configurable: true,
    })

    await user.click(screen.getByRole('button', { name: 'Copy error details' }))

    expect((await screen.findByRole('status')).textContent).toBe('Couldn’t copy. Select the error text above instead.')
  })
})
