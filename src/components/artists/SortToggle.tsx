import { useNavigate } from '@tanstack/react-router'
import type { SortOrder } from '../../library/presentation.ts'

const OPTIONS = [
  { value: 'count', label: 'Count', name: 'Count' },
  { value: 'alpha', label: 'A–Z', name: 'A to Z' },
] as const satisfies ReadonlyArray<{ value: SortOrder; label: string; name: string }>

export function SortToggle({ sort }: { sort: SortOrder }) {
  const navigate = useNavigate()

  return (
    <fieldset className="flex gap-0.5 rounded-md border border-border bg-background p-0.75">
      <legend className="sr-only">Sort artists</legend>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex h-6.5 cursor-pointer items-center rounded-sm px-2.5 text-sm text-muted transition-colors hover:text-text has-checked:bg-accent has-checked:font-semibold has-checked:text-on-accent has-focus-visible:shadow-[inset_0_0_0_2px_var(--color-accent),0_0_0_1px_var(--color-bright-accent)]"
        >
          <input
            type="radio"
            name="artist-sort"
            value={option.value}
            checked={sort === option.value}
            onChange={() => navigate({ to: '.', search: (prev) => ({ ...prev, sort: option.value }), replace: true })}
            className="sr-only"
          />
          <span aria-hidden>{option.label}</span>
          <span className="sr-only">{option.name}</span>
        </label>
      ))}
    </fieldset>
  )
}
