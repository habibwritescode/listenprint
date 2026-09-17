import { artistInitial, avatarTone } from '../../library/presentation.ts'
import type { AvatarTone } from '../../library/presentation.ts'

interface ArtistAvatarProps {
  name: string
  size?: keyof typeof SIZE_CLASSES
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

/** The letter tile is the default visual, not a placeholder: the demo has no images at all. */
export function ArtistAvatar({ name, size = 'row' }: ArtistAvatarProps) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center font-semibold ${TONE_CLASSES[avatarTone(name)]} ${SIZE_CLASSES[size]}`}
    >
      {artistInitial(name)}
    </span>
  )
}
