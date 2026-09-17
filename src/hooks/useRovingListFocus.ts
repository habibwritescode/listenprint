import { useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { rovingTargetIndex } from './roving-focus.ts'

interface RovingListFocusOptions {
  count: number
  scrollToIndex: (index: number) => void
}

function rowIndexOf(target: EventTarget | null): number | null {
  const row = target instanceof Element ? target.closest('[aria-posinset]') : null
  return row ? Number(row.getAttribute('aria-posinset')) - 1 : null
}

export function useRovingListFocus({ count, scrollToIndex }: RovingListFocusOptions) {
  const listRef = useRef<HTMLOListElement | null>(null)
  const pendingFocusIndex = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  // The row holding focus, while focus is inside the list.
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

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
    if (index === null) return
    setActiveIndex(index)
    setFocusedIndex(index)
  }

  const onBlur = (event: FocusEvent<HTMLOListElement>) => {
    if (!listRef.current?.contains(event.relatedTarget as Node | null)) setFocusedIndex(null)
  }

  /**
   * Rows the virtualizer must keep rendered: the focused row and the row keyboard focus is heading to. Only while focus
   * is in the list, so a list scrolled away with the mouse still offers an on-screen row to Tab into.
   */
  const keptIndexes = focusedIndex === null ? [] : [focusedIndex, activeIndex]

  return { attachList, activeIndex, keptIndexes, onKeyDown, onFocus, onBlur }
}
