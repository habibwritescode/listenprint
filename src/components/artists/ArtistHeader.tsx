import type { ArtistRef } from '../../library/types.ts'
import { artistTileName } from '../../navigation/view-transitions.ts'
import { ArtistAvatar } from './ArtistAvatar.tsx'

interface ArtistHeaderProps {
  artist: ArtistRef
  kicker: string
  spotifyUrl: string | null
  /** Shown in the link's place when there is no link: a stated fact, never a dead button. */
  noLinkNote: string
  /** The artist's genre tags; empty or missing ones are stated by `noGenresNote` instead. */
  genres?: readonly string[]
  /** Why there are no tags: Spotify has none, or this artist was never looked up. */
  noGenresNote?: string
  photoUrl?: string | null
}

// The 96px tile is the same letter avatar as the 44px row tile, and shares its transition name, so a list-to-detail
// transition can scale one element.
export function ArtistHeader(props: ArtistHeaderProps) {
  const { artist, kicker, spotifyUrl, noLinkNote, genres = [], noGenresNote, photoUrl } = props
  return (
    <header className="flex flex-wrap items-end gap-5">
      <ArtistAvatar name={artist.name} size="header" imageUrl={photoUrl} transitionName={artistTileName(artist.id)} />
      <div className="min-w-0 flex-[1_1_260px]">
        <p className="text-2xs tracking-[0.12em] text-subtle uppercase tabular-nums">{kicker}</p>
        <h1
          id="artist-title"
          className="mt-2 text-[clamp(25px,3.6vw,36px)] leading-[1.05] font-bold tracking-[-0.03em] wrap-break-word"
        >
          {artist.name}
        </h1>
        <div className="mt-3.25 flex flex-wrap items-center gap-2">
          {spotifyUrl ? (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-border bg-soft-accent px-2.75 py-1 text-sm text-bright-accent transition-colors hover:border-accent"
            >
              Open in Spotify<span aria-hidden> ↗</span>
            </a>
          ) : (
            <p className="rounded-full border border-dashed border-border px-2.75 py-1 text-sm text-subtle">
              {noLinkNote}
            </p>
          )}
          {genres.slice(0, 3).map((genre) => (
            <p key={genre} className="rounded-full border border-border bg-background px-2.75 py-1 text-sm text-muted">
              {genre}
            </p>
          ))}
          {genres.length === 0 && noGenresNote && (
            <p className="rounded-full border border-dashed border-border px-2.75 py-1 text-sm text-subtle">
              {noGenresNote}
            </p>
          )}
        </div>
      </div>
    </header>
  )
}
