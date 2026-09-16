// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { rankArtists } from '../library/rankings.ts'
import { expectNoAxeViolations } from './axe.ts'
import { renderApp, testLibrary } from './render-app.ts'

beforeAll(async () => {
  await Promise.all([import('../routes/DemoPage.tsx'), import('../routes/DemoArtistPage.tsx')])
})

afterEach(cleanup)

function siteHeader() {
  return screen.getByTestId('site-header')
}

describe('site header', () => {
  it('shows the wordmark, the sample-data chip and the mode pills on /demo, with no nav links', async () => {
    const { container } = renderApp('/demo?mode=primary')
    await screen.findByRole('list', { name: 'Artists ranked by liked songs' })
    const header = within(siteHeader())

    expect(header.getByRole('link', { name: 'listenprint' }).getAttribute('href')).toBe('/')
    expect(header.getByText('Sample data')).toBeDefined()
    expect(header.getByRole('group', { name: 'Ranking mode' })).toBeDefined()
    expect(header.getByRole<HTMLInputElement>('radio', { name: 'Primary artist only' }).checked).toBe(true)
    expect(header.queryByRole('navigation')).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('has no chip or mode pills on the home page', async () => {
    renderApp('/')
    await screen.findByRole('heading', { level: 1 })
    const header = within(siteHeader())

    expect(header.getByRole('link', { name: 'listenprint' })).toBeDefined()
    expect(header.queryByText('Sample data')).toBeNull()
    expect(header.queryByRole('group', { name: 'Ranking mode' })).toBeNull()
  })
})

describe('back bar on artist pages', () => {
  it('replaces the header on a demo artist page, keeping the mode and the chip', async () => {
    const [top] = rankArtists(testLibrary.tracks, 'primary')
    const { container } = renderApp(`/demo/artist/${top.artist.id}?mode=primary`)
    await screen.findByRole('heading', { level: 1, name: top.artist.name })
    const bar = within(siteHeader())

    expect(bar.getByRole('link', { name: 'Back to ranking' }).getAttribute('href')).toBe('/demo?mode=primary')
    expect(bar.getByText('Sample data')).toBeDefined()
    expect(bar.queryByRole('link', { name: 'listenprint' })).toBeNull()
    expect(bar.queryByRole('group', { name: 'Ranking mode' })).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('goes back to the home page from a live artist page, with no chip', async () => {
    renderApp('/artist/abc123')

    await waitFor(() => expect(within(siteHeader()).getByRole('link', { name: 'Back to ranking' })).toBeDefined())
    expect(within(siteHeader()).getByRole('link', { name: 'Back to ranking' }).getAttribute('href')).toBe('/')
    expect(within(siteHeader()).queryByText('Sample data')).toBeNull()
  })
})
