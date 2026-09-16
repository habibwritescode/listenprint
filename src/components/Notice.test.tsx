// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../test/axe.ts'
import { Notice } from './Notice.tsx'
import { SampleDataChip } from './SampleDataChip.tsx'
import { primaryActionClass } from './action-styles.ts'

afterEach(cleanup)

describe('Notice', () => {
  it('names its section with the headline', () => {
    render(<Notice title="You cancelled the Spotify sign-in." body="Nothing was connected." />)

    const section = screen.getByRole('region', { name: 'You cancelled the Spotify sign-in.' })
    expect(section.contains(screen.getByRole('heading', { level: 1 }))).toBe(true)
    screen.getByText('Nothing was connected.')
  })

  it.each(['product', 'attention', 'neutral'] as const)('marks a %s kicker with its tone', (tone) => {
    render(<Notice tone={tone} kicker="Sign-in stopped" title="Title" body="Body" />)

    expect(screen.getByText('Sign-in stopped').dataset.tone).toBe(tone)
  })

  it('renders only the parts it is given', () => {
    const { container } = render(<Notice title="Title" body="Body" />)

    expect(container.querySelector('[data-tone]')).toBeNull()
    expect(container.querySelector('[data-slot]')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders the optional parts and actions', () => {
    render(
      <Notice
        tone="attention"
        kicker="Network"
        title="Couldn't reach Spotify."
        body="The request failed."
        body2="Nothing was saved."
        detail="/artists/top"
        meta="Step 2 of 3"
        spinner
      >
        <button type="button" className={primaryActionClass}>
          Try again
        </button>
      </Notice>,
    )

    screen.getByText('Nothing was saved.')
    expect(screen.getByText('/artists/top').dataset.slot).toBe('detail')
    expect(screen.getByText('Step 2 of 3').dataset.slot).toBe('meta')
    expect(screen.getByRole('button', { name: 'Try again' }).parentElement?.dataset.slot).toBe('actions')
  })

  it('hides the spinner from assistive technology', () => {
    const { container } = render(<Notice title="Connecting to Spotify…" body="Verifying." spinner />)

    expect(container.querySelector('[data-slot="spinner"]')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('announces itself as a status only when asked', () => {
    render(<Notice title="Connecting to Spotify…" body="Verifying." role="status" />)

    screen.getByRole('status', { name: 'Connecting to Spotify…' })
  })

  it('has no accessibility violations with every part shown', async () => {
    const { container } = render(
      <Notice
        tone="product"
        kicker="Client-side Spotify analytics"
        title="See which artists actually own your library."
        body="Body"
        body2="Second body"
        detail="Detail"
        meta="Meta"
        spinner
        role="status"
      >
        <button type="button" className={primaryActionClass} disabled>
          Opening Spotify…
        </button>
        <SampleDataChip />
      </Notice>,
    )

    await expectNoAxeViolations(container)
  })
})

describe('SampleDataChip', () => {
  it('reads as words rather than spelled-out capitals', () => {
    render(<SampleDataChip />)

    expect(screen.getByText('Sample data').className).toContain('uppercase')
  })
})
