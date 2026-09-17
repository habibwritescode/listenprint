import { Link, getRouteApi, useLocation, useNavigate } from '@tanstack/react-router'
import { useLibrary } from '../../hooks/useLibrary.ts'
import { albumArtByArtist } from '../../library/artist-images.ts'
import { artistTracks } from '../../library/rankings.ts'
import { Notice } from '../Notice.tsx'
import { primaryActionClass, softActionClass } from '../action-styles.ts'
import { ArtistView } from '../artists/ArtistView.tsx'

const route = getRouteApi('/artist/$artistId')

/** An artist from the signed-in user's saved library. */
export function LiveArtist() {
  const { artistId } = route.useParams()
  const search = route.useSearch()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { session, library, details } = useLibrary()

  if (library.isPending) return null

  const saved = library.data ?? null
  if (!saved) {
    const scan = () => {
      // Progress lives on the home page, which is also where the ranking appears.
      void navigate({ to: '/', search })
      void session.startScan('initial')
    }
    return (
      <Notice
        align="start"
        tone="neutral"
        kicker="Nothing loaded yet"
        title="Your library isn’t loaded yet."
        body="Artist pages read the library saved in this browser, and there isn’t one yet. Scanning takes about 40 seconds for a 10,000-track library."
      >
        <button type="button" onClick={scan} className={primaryActionClass}>
          Scan my library
        </button>
        <Link to="/demo" className={softActionClass}>
          See the sample library
        </Link>
      </Notice>
    )
  }

  const artist = artistTracks(saved.tracks, artistId, 'all')
    .at(0)
    ?.artists.find((credit) => credit.id === artistId)

  if (!artist) {
    return (
      <Notice
        tone="neutral"
        kicker="Not in this library"
        title="That artist isn’t in your library."
        body="The id in the address doesn’t match any artist in the library saved in this browser. Artist links belong to one library, so a link from someone else’s Listenprint won’t open here."
        detail={pathname}
      >
        <Link to="/" search={search} className={primaryActionClass}>
          Back to ranking
        </Link>
      </Notice>
    )
  }

  return (
    <ArtistView
      library={saved}
      artist={artist}
      mode={search.mode}
      sort={search.sort}
      basePath="/"
      photoUrl={details.data?.[artist.id]?.details?.imageUrl ?? albumArtByArtist(saved.tracks).get(artist.id)}
    />
  )
}
