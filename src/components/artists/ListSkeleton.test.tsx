// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ListSkeleton } from './ListSkeleton.tsx'

afterEach(cleanup)

describe('ListSkeleton', () => {
  it('announces loading in a busy status region with placeholder rows', () => {
    const { container } = render(<ListSkeleton label="Building demo library…" />)

    const status = screen.getByRole('status')

    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.textContent).toContain('Building demo library…')
    expect(container.querySelectorAll('[data-slot="skeleton-row"]').length).toBeGreaterThan(0)
  })
})
