import { Link, useMatch } from '@tanstack/react-router'
import { SampleDataChip } from './SampleDataChip.tsx'
import { RankingModeToggle } from './artists/RankingModeToggle.tsx'
import { HeaderIdentity } from './auth/HeaderIdentity.tsx'

const backLinkClass = 'rounded-md px-1 text-md text-muted transition-colors hover:text-text'

function BackLabel() {
  return (
    <>
      <span aria-hidden>← </span>Back to ranking
    </>
  )
}

/**
 * What the header holds on each route. Artist pages swap the wordmark for a back link, the one strip that's always
 * there, so the sample-data chip moves into it on demo artists.
 */
export function HeaderContent() {
  const demoList = useMatch({ from: '/demo', shouldThrow: false })
  const demoArtist = useMatch({ from: '/demo/artist/$artistId', shouldThrow: false })
  const liveArtist = useMatch({ from: '/artist/$artistId', shouldThrow: false })

  if (demoArtist) {
    return (
      <>
        <Link to="/demo" search={demoArtist.search} className={backLinkClass}>
          <BackLabel />
        </Link>
        <span className="flex-1" />
        <SampleDataChip />
      </>
    )
  }
  if (liveArtist) {
    return (
      <Link to="/" className={backLinkClass}>
        <BackLabel />
      </Link>
    )
  }

  return (
    <>
      <Link to="/" className="flex items-center gap-2 text-base font-semibold tracking-[-0.02em] text-text">
        <span aria-hidden className="size-2.75 rounded-[3px] bg-accent" />
        listenprint
      </Link>
      {demoList && <SampleDataChip />}
      <span className="flex-1" />
      {demoList && <RankingModeToggle mode={demoList.search.mode} />}
      <HeaderIdentity />
    </>
  )
}
