import { describe, expect, it } from 'vitest'
import { rovingTargetIndex, tabbableRowIndex, withKeptRows } from './roving-focus.ts'

describe('rovingTargetIndex', () => {
  it('moves down one row and stops at the last row', () => {
    expect(rovingTargetIndex('ArrowDown', 3, 10)).toBe(4)
    expect(rovingTargetIndex('ArrowDown', 9, 10)).toBe(9)
  })

  it('moves up one row and stops at the first row', () => {
    expect(rovingTargetIndex('ArrowUp', 3, 10)).toBe(2)
    expect(rovingTargetIndex('ArrowUp', 0, 10)).toBe(0)
  })

  it('jumps to the first and last rows with Home and End', () => {
    expect(rovingTargetIndex('Home', 5, 10)).toBe(0)
    expect(rovingTargetIndex('End', 5, 10)).toBe(9)
  })

  it('ignores other keys', () => {
    expect(rovingTargetIndex('Tab', 5, 10)).toBeNull()
    expect(rovingTargetIndex('Enter', 5, 10)).toBeNull()
  })

  it('does nothing for an empty list', () => {
    expect(rovingTargetIndex('ArrowDown', 0, 0)).toBeNull()
  })
})

describe('withKeptRows', () => {
  it('adds kept rows to the rendered range, sorted, without duplicates', () => {
    expect(withKeptRows([10, 11, 12], [0, 11, 1999], 2000)).toEqual([0, 10, 11, 12, 1999])
  })

  it('ignores kept rows that are unset or outside the list', () => {
    expect(withKeptRows([3, 4], [null, -1, 50], 10)).toEqual([3, 4])
  })
})

describe('tabbableRowIndex', () => {
  it('keeps the active row as the Tab stop while it is rendered', () => {
    expect(tabbableRowIndex(7, [5, 6, 7, 8])).toBe(7)
  })

  it('falls back to the first rendered row, so the list stays reachable with Tab', () => {
    expect(tabbableRowIndex(0, [40, 41, 42])).toBe(40)
  })

  it('has no Tab stop when nothing is rendered', () => {
    expect(tabbableRowIndex(0, [])).toBe(-1)
  })
})
