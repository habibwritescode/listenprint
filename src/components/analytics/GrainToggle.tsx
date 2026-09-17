import { useNavigate } from '@tanstack/react-router'
import type { TimelineGrain } from '../../library/timeline-grain.ts'

interface GrainToggleProps {
  grain: TimelineGrain
  basePath: '/timeline' | '/demo/timeline'
}

const OPTIONS = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
] as const satisfies ReadonlyArray<{ value: TimelineGrain; label: string }>

/** Grain lives in the URL like every other control, so a yearly view is a shareable link. */
export function GrainToggle({ grain, basePath }: GrainToggleProps) {
  const navigate = useNavigate()

  return (
    <fieldset className="flex gap-0.5 rounded-md border border-border bg-background p-0.75">
      <legend className="sr-only">Timeline grain</legend>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex h-6.5 cursor-pointer items-center rounded-sm px-2.5 text-sm text-muted transition-colors hover:text-text has-checked:bg-accent has-checked:font-semibold has-checked:text-on-accent has-focus-visible:shadow-[inset_0_0_0_2px_var(--color-bright-accent)]"
        >
          <input
            type="radio"
            name="timeline-grain"
            value={option.value}
            checked={grain === option.value}
            onChange={() =>
              navigate({ to: basePath, search: (prev) => ({ ...prev, grain: option.value }), replace: true })
            }
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}
