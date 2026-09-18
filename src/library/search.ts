import type { ArtistRanking } from './types.ts'

export interface NamePart {
  text: string
  /** Part of the query's match, which the row draws in the highlight tone. */
  match: boolean
}

/**
 * One character folded, or itself when folding would change its length. Highlighting slices the name by the position
 * of a match in the folded text, so the two must line up: decomposing a Hangul syllable gives three jamo, and İ
 * lowercases to two characters, either of which would otherwise shift every following slice.
 */
function foldCharacter(character: string): string {
  const folded = character.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  return folded.length === character.length ? folded : character
}

/**
 * How names and queries are compared: lowercased and stripped of accents, so someone typing on a plain keyboard finds
 * Björk. The result has the same length as the text, so a match's position in it is its position in the name.
 */
export function foldName(text: string): string {
  return [...text].map(foldCharacter).join('')
}

/** The rankings whose artist name contains the query, in their ranked order. An empty query filters nothing. */
export function filterArtists(rankings: readonly ArtistRanking[], query: string): ArtistRanking[] {
  const folded = foldName(query.trim())
  // An empty query matches everything anyway; returning early keeps thousands of names from being folded for nothing.
  if (folded === '') return [...rankings]
  return rankings.filter((ranking) => foldName(ranking.artist.name).includes(folded))
}

/** A name split into its matched and unmatched pieces, which rejoin to exactly the name the library holds. */
export function highlightParts(name: string, query: string): NamePart[] {
  const folded = foldName(query.trim())
  const haystack = foldName(name)
  if (folded === '') return [{ text: name, match: false }]

  const parts: NamePart[] = []
  let cursor = 0
  for (let at = haystack.indexOf(folded); at !== -1; at = haystack.indexOf(folded, cursor)) {
    if (at > cursor) parts.push({ text: name.slice(cursor, at), match: false })
    parts.push({ text: name.slice(at, at + folded.length), match: true })
    cursor = at + folded.length
  }
  if (parts.length === 0) return [{ text: name, match: false }]
  if (cursor < name.length) parts.push({ text: name.slice(cursor), match: false })
  return parts
}
