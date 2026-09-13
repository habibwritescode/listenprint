import { describe, expect, it } from 'vitest'
import { rovingTargetIndex } from './roving-focus.ts'

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
