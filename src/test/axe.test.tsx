// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from './axe.ts'

afterEach(cleanup)

describe('expectNoAxeViolations', () => {
  it('passes for markup without violations', async () => {
    const { container } = render(
      <main>
        <h1>Rankings</h1>
        <button type="button">Refresh</button>
      </main>,
    )

    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined()
  })

  it('fails with the rule id and the offending element for an image without alt text', async () => {
    const { container } = render(
      <main>
        <h1>Rankings</h1>
        <img src="/cover.png" />
      </main>,
    )

    const failure = expectNoAxeViolations(container)

    await expect(failure).rejects.toThrow(/image-alt/)
    await expect(failure).rejects.toThrow(/img/)
  })
})
