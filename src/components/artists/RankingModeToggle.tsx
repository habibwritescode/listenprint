import { useNavigate } from '@tanstack/react-router'
import type { RankingMode } from '../../library/types.ts'

interface RankingModeToggleProps {
  mode: RankingMode
}

const OPTIONS = [
  { value: 'all', label: 'Every credited artist' },
  { value: 'primary', label: 'Primary artist only' },
] as const satisfies ReadonlyArray<{ value: RankingMode; label: string }>

export function RankingModeToggle({ mode }: RankingModeToggleProps) {
  const navigate = useNavigate()

  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">Count artists</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              name="ranking-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => navigate({ to: '.', search: (prev) => ({ ...prev, mode: option.value }), replace: true })}
              className="accent-accent"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
