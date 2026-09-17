import { Link, useMatch } from '@tanstack/react-router'
import { useLibraryChrome } from '../hooks/useLibraryChrome.ts'
import { AnalyticsNav } from './AnalyticsNav.tsx'
import { BackToRanking } from './BackToRanking.tsx'
import { SampleDataChip } from './SampleDataChip.tsx'
import { GrainToggle } from './analytics/GrainToggle.tsx'
import { RankingModeToggle } from './artists/RankingModeToggle.tsx'
import { HeaderIdentity } from './auth/HeaderIdentity.tsx'

/**
 * What the header holds on each route. Artist pages swap the wordmark for a back link, the one strip that's always
 * there, so the sample-data chip moves into it on demo artists.
 */
export function HeaderContent() {
  const home = useMatch({ from: '/', shouldThrow: false })
  const demoList = useMatch({ from: '/demo', shouldThrow: false })
  const { hasLibrary, refreshing } = useLibraryChrome()
  const demoArtist = useMatch({ from: '/demo/artist/$artistId', shouldThrow: false })
  const liveArtist = useMatch({ from: '/artist/$artistId', shouldThrow: false })
  const genres = useMatch({ from: '/genres', shouldThrow: false })
  const timeline = useMatch({ from: '/timeline', shouldThrow: false })
  const demoGenres = useMatch({ from: '/demo/genres', shouldThrow: false })
  const demoTimeline = useMatch({ from: '/demo/timeline', shouldThrow: false })
  const demo = demoList ?? demoGenres ?? demoTimeline
  const timelineMatch = timeline ?? demoTimeline
  // The nav needs a library to lead to: signed out, or before a scan, the home page is the only useful view.
  const nav = demo ?? genres ?? timeline ?? (hasLibrary ? home : null)

  if (demoArtist) {
    return (
      <>
        <BackToRanking basePath="/demo" search={demoArtist.search} />
        <span className="flex-1" />
        <SampleDataChip />
      </>
    )
  }
  if (liveArtist) {
    return <BackToRanking basePath="/" search={liveArtist.search} />
  }

  return (
    <>
      <Link to="/" className="flex items-center gap-2 text-base font-semibold tracking-[-0.02em] text-text">
        <span aria-hidden className="size-2.75 rounded-[3px] bg-accent" />
        listenprint
      </Link>
      {demo && <SampleDataChip />}
      <span className="flex-1" />
      {timelineMatch && (
        <GrainToggle
          grain={timelineMatch.search.grain}
          basePath={demoTimeline ? '/demo/timeline' : '/timeline'}
        />
      )}
      {demoList && <RankingModeToggle mode={demoList.search.mode} basePath="/demo" />}
      {demoGenres && <RankingModeToggle mode={demoGenres.search.mode} basePath="/demo/genres" />}
      {genres && <RankingModeToggle mode={genres.search.mode} basePath="/genres" />}
      {home && hasLibrary && (
        // Dimmed while a refresh runs: the pills still work, on the ranking from the last scan.
        <div data-stale={refreshing ? '' : undefined} className="transition-opacity data-stale:opacity-55">
          <RankingModeToggle mode={home.search.mode} basePath="/" />
        </div>
      )}
      <HeaderIdentity />
      {nav && (
        <AnalyticsNav basePath={demo ? '/demo' : '/'} search={{ mode: nav.search.mode, sort: nav.search.sort }} />
      )}
    </>
  )
}
