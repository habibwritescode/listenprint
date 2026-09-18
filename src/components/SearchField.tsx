import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

interface SearchFieldProps {
  /** The query the URL holds; typing runs ahead of it. */
  query: string
  /** Every keystroke, so the list filters as you type. */
  onQueryChange: (query: string) => void
  /** Once typing stops, so the URL gets one entry rather than one per character. */
  onCommit: (query: string) => void
  /** Announced for screen readers; null while there is nothing to report. */
  matchCount: number | null
  /** ArrowDown hands the keyboard to the list. */
  onEnterList?: () => void
}

const COMMIT_DELAY_MS = 150

const PLACEHOLDER = 'text-text placeholder:text-subtle'

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName))
}

/**
 * The header's artist filter. It owns what's typed so a long list redraws on every keystroke, and hands the query to
 * the URL once typing stops. `/` and ⌘K reach it from anywhere, scrolling to the top so a hidden header comes back.
 */
export function SearchField({ query, onQueryChange, onCommit, matchCount, onEnterList }: SearchFieldProps) {
  const [text, setText] = useState(query)
  const [urlQuery, setUrlQuery] = useState(query)
  const fieldRef = useRef<HTMLInputElement>(null)

  // A query that arrives from elsewhere — a pasted link, Back, a cleared filter — replaces what the field shows.
  // React's own pattern for a prop-driven reset, rather than an effect that would render twice for every keystroke.
  if (query !== urlQuery) {
    setUrlQuery(query)
    setText(query)
  }

  // The URL catches up once typing stops, so a word is one history entry rather than one per letter.
  useEffect(() => {
    if (text === query) return
    const timer = setTimeout(() => onCommit(text), COMMIT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text, query, onCommit])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const commandK = event.key === 'k' && (event.metaKey || event.ctrlKey)
      const shortcut = event.key === '/' ? !isTypingTarget(event.target) : commandK
      if (!shortcut) return
      event.preventDefault()
      window.scrollTo({ top: 0 })
      fieldRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const change = (value: string) => {
    setText(value)
    onQueryChange(value)
  }

  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      change('')
    }
    if (event.key === 'ArrowDown' && onEnterList) {
      event.preventDefault()
      onEnterList()
    }
  }

  return (
    <div className="relative flex-1 md:max-w-64">
      <input
        ref={fieldRef}
        type="search"
        value={text}
        aria-label="Search artists"
        placeholder="Search artists"
        onChange={(event) => change(event.target.value)}
        onKeyDown={onFieldKeyDown}
        className={`h-8.5 w-full rounded-md border border-border bg-background pr-13 pl-3 text-md ${PLACEHOLDER}`}
      />
      <span aria-hidden className="pointer-events-none absolute top-1.5 right-2 text-2xs text-subtle tabular-nums">
        ⌘K
      </span>
      <p role="status" className="sr-only">
        {matchCount === null || query === '' ? '' : `${matchCount} artist${matchCount === 1 ? '' : 's'} match ${query}`}
      </p>
    </div>
  )
}
