import { artistInitial } from '../../library/presentation.ts'

interface ArtistAvatarProps {
  name: string
}

export function ArtistAvatar({ name }: ArtistAvatarProps) {
  return (
    <span
      aria-hidden
      className="grid size-10.5 shrink-0 place-items-center rounded-sm bg-surface-raised font-black text-accent-soft min-[741px]:size-12"
    >
      {artistInitial(name)}
    </span>
  )
}
