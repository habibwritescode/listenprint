import { useNavigate } from '@tanstack/react-router'
import type { RankingMode } from '../../library/types.ts'
import type { LibraryBase } from './library-paths.ts'

interface RankingModeToggleProps {
  mode: RankingMode
  /** The route the toggle stays on: the ranking, or the genre breakdown, which reads the same mode. */
  basePath: LibraryBase | '/genres' | '/demo/genres'
}

// The visible label is one word; the accessible name starts with it, so voice control still matches. One text node,
// because spaces at the edge of a separate screen-reader-only span get trimmed.
const OPTIONS = [
  { value: 'all', label: 'All', rest: ' credited artists' },
  { value: 'primary', label: 'Primary', rest: ' artist only' },
] as const satisfies ReadonlyArray<{ value: RankingMode; label: string; rest: string }>

export function RankingModeToggle({ mode, basePath }: RankingModeToggleProps) {
  const navigate = useNavigate()

  return (
    <fieldset className="flex gap-0.5 rounded-md border border-border bg-background p-0.75">
      <legend className="sr-only">Ranking mode</legend>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex h-6.5 cursor-pointer items-center rounded-sm px-2.5 text-sm text-muted transition-colors hover:text-text has-checked:bg-accent has-checked:font-semibold has-checked:text-on-accent has-focus-visible:shadow-[inset_0_0_0_2px_var(--color-bright-accent)]"
        >
          <input
            type="radio"
            name="ranking-mode"
            value={option.value}
            checked={mode === option.value}
            onChange={() =>
              navigate({ to: basePath, search: (prev) => ({ ...prev, mode: option.value }), replace: true })
            }
            className="sr-only"
          />
          <span aria-hidden>{option.label}</span>
          <span className="sr-only">{`${option.label}${option.rest}`}</span>
        </label>
      ))}
    </fieldset>
  )
}
