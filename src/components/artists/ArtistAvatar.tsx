import { useState } from 'react'
import { artistInitial, avatarTone } from '../../library/presentation.ts'
import type { AvatarTone } from '../../library/presentation.ts'

interface ArtistAvatarProps {
  name: string
  size?: keyof typeof SIZE_CLASSES
  /** A photo painted over the letter tile. */
  imageUrl?: string | null
}

const SIZE_CLASSES = {
  row: 'size-11 rounded-md text-xl',
  header: 'size-24 rounded-lg text-[40px] tracking-[-0.03em]',
  identity: 'size-6 rounded-full text-xs',
  art: 'size-10 rounded-sm text-base',
} as const

// Spelled out so Tailwind can find every class in the source.
const TONE_CLASSES: Record<AvatarTone, string> = {
  1: 'bg-avatar-tint-1 text-avatar-ink-1',
  2: 'bg-avatar-tint-2 text-avatar-ink-2',
  3: 'bg-avatar-tint-3 text-avatar-ink-3',
  4: 'bg-avatar-tint-4 text-avatar-ink-4',
}

type PhotoResult = { url: string; state: 'loaded' | 'failed' }

/**
 * The letter tile is the default visual, not a placeholder: the demo has no images at all. A photo paints over it, so
 * a slow or failed one costs nothing: no broken-image icon, no reflow, no retry.
 */
export function ArtistAvatar({ name, size = 'row', imageUrl = null }: ArtistAvatarProps) {
  const [result, setResult] = useState<PhotoResult | null>(null)
  const photoState = imageUrl === null ? null : result?.url === imageUrl ? result.state : 'loading'

  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center overflow-hidden font-semibold ${TONE_CLASSES[avatarTone(name)]} ${SIZE_CLASSES[size]}`}
    >
      {artistInitial(name)}
      {photoState === 'loading' && (
        <span
          data-slot="shimmer"
          className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,var(--color-raised-surface)_0%,var(--color-border)_42%,var(--color-raised-surface)_82%)] bg-size-[380px_100%]"
        />
      )}
      {imageUrl !== null && photoState !== 'failed' && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          data-state={photoState}
          onLoad={() => setResult({ url: imageUrl, state: 'loaded' })}
          onError={() => setResult({ url: imageUrl, state: 'failed' })}
          className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-fade data-[state=loaded]:opacity-100"
        />
      )}
    </span>
  )
}
