/** Where a library's ranking lives: `/` for the signed-in user's library, `/demo` for the sample. */
export type LibraryBase = '/' | '/demo'

export function artistPath(base: LibraryBase) {
  return base === '/demo' ? '/demo/artist/$artistId' : '/artist/$artistId'
}
