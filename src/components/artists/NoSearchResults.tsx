import { primaryActionClass } from '../action-styles.ts'

interface NoSearchResultsProps {
  query: string
  onClear: () => void
}

/** Search covers artist names, which is the likeliest reason a query found nothing. */
export function NoSearchResults({ query, onClear }: NoSearchResultsProps) {
  return (
    <div className="space-y-3.5 px-6.5 py-12 text-center">
      <p className="text-lg font-semibold">{`Nothing matches “${query}”`}</p>
      <p className="mx-auto max-w-[52ch] text-base text-muted">
        Search looks at artist names, not song or album titles. Check the spelling, or try a shorter piece of the name.
      </p>
      <button type="button" onClick={onClear} className={primaryActionClass}>
        Clear the search
      </button>
    </div>
  )
}
