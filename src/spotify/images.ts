import { isNonEmptyString, isRecord } from '../auth/guards.ts'

/**
 * From a Spotify `images` array: the smallest image at least `minWidth` wide, else the widest, else the first when no
 * widths are given. Malformed entries are ignored.
 */
export function pickImageUrl(images: unknown, minWidth: number): string | null {
  if (!Array.isArray(images)) return null
  const usable = images.flatMap((image) =>
    isRecord(image) && isNonEmptyString(image.url)
      ? [{ url: image.url, width: typeof image.width === 'number' ? image.width : null }]
      : [],
  )
  const sized = usable.filter((image): image is { url: string; width: number } => image.width !== null)
  const largeEnough = sized.filter((image) => image.width >= minWidth)
  if (largeEnough.length > 0) return largeEnough.reduce((a, b) => (b.width < a.width ? b : a)).url
  if (sized.length > 0) return sized.reduce((a, b) => (b.width > a.width ? b : a)).url
  return usable[0]?.url ?? null
}
