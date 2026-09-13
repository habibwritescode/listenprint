import { useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { rovingTargetIndex } from './roving-focus.ts'

interface RovingListFocusOptions {
  count: number
  /** Indexes of the rows currently in the DOM; a virtualized list renders only some of them. */
  renderedIndexes: readonly number[]
  scrollToIndex: (index: number) => void
}

function rowIndexOf(target: EventTarget): number | null {
  const row = (target as HTMLElement).closest('[aria-posinset]')
  return row ? Number(row.getAttribute('aria-posinset')) - 1 : null
}

export function useRovingListFocus({ count, renderedIndexes, scrollToIndex }: RovingListFocusOptions) {
  const listRef = useRef<HTMLOListElement | null>(null)
  const pendingFocusIndex = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const focusRow = (index: number): boolean => {
    const link = listRef.current?.querySelector<HTMLElement>(`[aria-posinset="${index + 1}"] a`)
    link?.focus()
    return link != null
  }

  // No dependency list on purpose: a row requested from the keyboard may only render after the
  // virtualizer has scrolled to it, which can take several renders.
  useLayoutEffect(() => {
    if (pendingFocusIndex.current !== null && focusRow(pendingFocusIndex.current)) {
      pendingFocusIndex.current = null
    }
  })

  const attachList = (node: HTMLOListElement | null) => {
    listRef.current = node
  }

  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const currentIndex = rowIndexOf(event.target)
    if (currentIndex === null) return
    const target = rovingTargetIndex(event.key, currentIndex, count)
    if (target === null) return

    event.preventDefault()
    setActiveIndex(target)
    // Recorded before scrolling: the virtualizer may re-render synchronously inside scrollToIndex, and
    // the layout effect has to find the pending row when that render happens.
    pendingFocusIndex.current = target
    scrollToIndex(target)
    if (focusRow(target)) pendingFocusIndex.current = null
  }

  const onFocus = (event: FocusEvent<HTMLOListElement>) => {
    const index = rowIndexOf(event.target)
    if (index !== null) setActiveIndex(index)
  }

  // If the active row has scrolled out of the DOM, the first rendered row keeps the list reachable with Tab.
  const tabbableIndex = renderedIndexes.includes(activeIndex) ? activeIndex : (renderedIndexes[0] ?? -1)

  return { attachList, tabbableIndex, onKeyDown, onFocus }
}
