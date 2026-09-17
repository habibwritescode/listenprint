// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { describedBy } from '../../test/descriptions.ts'
import { makeArtist, makeTrack } from '../../test/factories.ts'
import { renderWithRouter } from '../../test/render-with-router.ts'
import { CoOccurringArtists } from './CoOccurringArtists.tsx'

afterEach(cleanup)

const subject = makeArtist({ id: 'subject', name: 'Velvet Harbor' })
const mira = makeArtist({ id: 'mira', name: 'Mira Duarte' })
const choir = makeArtist({ id: 'choir', name: 'Static Choir' })

const tracks = [
  makeTrack({ artists: [subject, mira] }),
  makeTrack({ artists: [subject, mira] }),
  makeTrack({ artists: [subject, choir] }),
  makeTrack({ artists: [mira] }),
]

function renderTable(rows = tracks) {
  return renderWithRouter(
    <CoOccurringArtists
      tracks={rows}
      artistId={subject.id}
      artistName={subject.name}
      mode="all"
      sort="count"
      basePath="/demo"
    />,
  )
}

describe('CoOccurringArtists', () => {
  it('lists who shares the most liked songs, linking to their pages', async () => {
    renderTable()

    const rows = await screen.findAllByRole('listitem')
    expect(rows.map((row) => within(row).getByRole('link').textContent)).toEqual(['Mira Duarte', 'Static Choir'])
    expect(within(rows[0]).getByRole('link').getAttribute('href')).toBe('/demo/artist/mira?mode=all&sort=count')
  })

  // The numbers are visible columns; a screen reader gets them as the link's description, not its name.
  it('describes each row with the shared count and the share of their own songs', async () => {
    renderTable()

    const [first] = await screen.findAllByRole('listitem')
    expect(within(first).getByText('2')).toBeDefined()
    expect(within(first).getByText('67%')).toBeDefined()
    expect(describedBy(within(first).getByRole('link'))).toBe('2 shared liked songs, 67% of theirs')
  })

  it('states the fact when nobody else is credited', async () => {
    renderTable([makeTrack({ artists: [subject] })])

    expect(await screen.findByText('No other artist is credited on Velvet Harbor’s liked songs.')).toBeDefined()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('has no axe violations', async () => {
    const { container } = renderTable()
    await screen.findAllByRole('listitem')
    await expectNoAxeViolations(container)
  })
})
