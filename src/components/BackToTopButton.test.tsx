// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackToTopButton } from './BackToTopButton.tsx'

function scrollWindowTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

function renderWithMain() {
  return render(
    <>
      <main id="content" tabIndex={-1} />
      <BackToTopButton />
    </>,
  )
}

afterEach(() => {
  cleanup()
  scrollWindowTo(0)
  vi.restoreAllMocks()
})

describe('BackToTopButton', () => {
  it('is not rendered until the page scrolls past one viewport height', async () => {
    renderWithMain()

    expect(screen.queryByRole('button', { name: 'Back to top' })).toBeNull()

    await act(async () => {
      scrollWindowTo(window.innerHeight + 1)
    })
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeDefined()
  })

  it('scrolls to the top and moves focus to the main content', async () => {
    const user = userEvent.setup()
    const scrollTo = vi.spyOn(window, 'scrollTo')
    renderWithMain()
    await act(async () => {
      scrollWindowTo(window.innerHeight * 3)
    })

    await user.click(screen.getByRole('button', { name: 'Back to top' }))

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    expect(document.activeElement?.id).toBe('content')
  })
})
