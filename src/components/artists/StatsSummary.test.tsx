// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { rankArtists } from '../../library/rankings.ts'
import { makeArtist, makeTrack } from '../../test/factories.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { StatsSummary } from './StatsSummary.tsx'

afterEach(cleanup)

const NOTES = { tracks: 'Sample library · the same for everyone', artists: 'Made-up artists, not on Spotify' }

function soloTracks(counts: readonly number[]) {
  return counts.flatMap((count, index) => {
    const artist = makeArtist({ name: `Solo ${String(index).padStart(3, '0')}` })
    return Array.from({ length: count }, () => makeTrack({ artists: [artist] }))
  })
}

function statValue(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
}

describe('StatsSummary', () => {
  it('shows concentration, saved tracks and artists, with the stacked bar legend', async () => {
    const tracks = soloTracks([...Array(10).fill(4), ...Array(90).fill(1), ...Array(20).fill(1)])
    const { container } = render(
      <StatsSummary rankings={rankArtists(tracks, 'all')} trackCount={tracks.length} notes={NOTES} />,
    )

    // 40 of 150 tracks at ranks 1–10; all 110 one-track artists tie at rank 11, so the next 90 holds 110 tracks.
    expect(statValue('Concentration')).toBe('27%')
    expect(screen.getByText('Top 10 artists · 40 of 150 tracks')).toBeDefined()
    expect(statValue('Saved tracks')).toBe('150')
    expect(statValue('Artists')).toBe('120')
    expect(screen.getByText(NOTES.tracks)).toBeDefined()
    expect(screen.getByText('Top 10 · 27%')).toBeDefined()
    expect(screen.getByText('Next 90 · 73%')).toBeDefined()
    expect(screen.queryByText(/The other/)).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('names the rest of the artists below rank 100', () => {
    const tracks = soloTracks([...Array(100).fill(2), ...Array(25).fill(1)])

    render(<StatsSummary rankings={rankArtists(tracks, 'all')} trackCount={tracks.length} notes={NOTES} />)

    expect(screen.getByText('The other 25 · 11%')).toBeDefined()
  })

  it('says how many artists share the top 10 when ties push it past ten', () => {
    const tracks = soloTracks([...Array(9).fill(3), ...Array(3).fill(2), 1])

    render(<StatsSummary rankings={rankArtists(tracks, 'all')} trackCount={tracks.length} notes={NOTES} />)

    expect(screen.getByText('Top 10 ranks · 12 artists · 33 of 34 tracks')).toBeDefined()
  })

  it('shows dashes rather than a made-up 0% for an empty library', () => {
    render(<StatsSummary rankings={[]} trackCount={0} notes={NOTES} />)

    expect(statValue('Concentration')).toBe('—')
    expect(statValue('Saved tracks')).toBe('0')
    expect(screen.queryByText(/Top 10 ·/)).toBeNull()
  })
})
