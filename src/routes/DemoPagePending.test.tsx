// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../test/axe.ts'
import { DemoPagePending } from './DemoPagePending.tsx'

afterEach(cleanup)

describe('DemoPagePending', () => {
  it('announces that the sample library is being built', async () => {
    const { container } = render(<DemoPagePending />)

    const status = screen.getByRole('status', { name: 'Building the sample library…' })
    expect(status.textContent).toContain('Everyone sees the same sample library')
    await expectNoAxeViolations(container)
  })
})
