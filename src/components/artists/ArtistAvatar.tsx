import { artistInitial } from '../../library/presentation.ts'

interface ArtistAvatarProps {
  name: string
  size?: 'row' | 'header'
}

const SIZE_CLASSES = {
  row: 'size-10.5 min-[741px]:size-12',
  header: 'size-18 text-3xl',
} as const

export function ArtistAvatar({ name, size = 'row' }: ArtistAvatarProps) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-sm bg-raised-surface font-black text-avatar-ink-1 ${SIZE_CLASSES[size]}`}
    >
      {artistInitial(name)}
    </span>
  )
}
