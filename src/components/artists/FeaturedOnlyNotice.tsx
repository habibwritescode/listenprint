import { Link } from '@tanstack/react-router'
import type { SortOrder } from '../../library/presentation.ts'
import type { ArtistRef } from '../../library/types.ts'
import { ghostActionClass, primaryActionClass } from '../action-styles.ts'
import { artistPath } from './library-paths.ts'
import type { LibraryBase } from './library-paths.ts'

interface FeaturedOnlyNoticeProps {
  artist: ArtistRef
  /** Every saved track crediting the artist, all of them as a featured artist. */
  savedTracks: number
  sort: SortOrder
  basePath: LibraryBase
}

const countFormat = new Intl.NumberFormat()

// Only the ranking part of the page is replaced, and the fix keeps you on this artist.
export function FeaturedOnlyNotice({ artist, savedTracks, sort, basePath }: FeaturedOnlyNoticeProps) {
  const tracks = `${countFormat.format(savedTracks)} saved ${savedTracks === 1 ? 'track' : 'tracks'}`

  return (
    <section
      aria-labelledby="featured-only-title"
      className="rounded-lg border border-border bg-surface px-5.5 pt-5 pb-5.5"
    >
      <p className="text-2xs tracking-[0.13em] text-highlight uppercase">Why this page is empty</p>
      <h2 id="featured-only-title" className="mt-3 text-lg font-semibold">
        Nothing to show in “primary artist only”
      </h2>
      <p className="mt-2 max-w-[62ch] text-base leading-[1.6] text-pretty text-muted">
        {`Every one of ${artist.name}’s ${tracks} is a featured credit, so this artist has no tracks ` +
          'where they are billed first. The current ranking mode counts primary credits only, which makes this ' +
          'page empty by definition rather than by error.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link
          to={artistPath(basePath)}
          params={{ artistId: artist.id }}
          search={{ mode: 'all', sort }}
          replace
          className={primaryActionClass}
        >
          Switch to all artists
        </Link>
        <Link to={basePath} search={{ mode: 'primary', sort }} className={ghostActionClass}>
          Back to ranking
        </Link>
      </div>
      <p className="mt-3.5 text-sm text-subtle">Switching keeps you on this artist.</p>
    </section>
  )
}
