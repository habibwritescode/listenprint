// @vitest-environment jsdom
import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWithRouter } from '../test/render-with-router.ts'
import { SiteHeader } from './SiteHeader.tsx'

function scrollWindowTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

afterEach(() => {
  cleanup()
  scrollWindowTo(0)
})

describe('SiteHeader', () => {
  it('hides while scrolling down and comes back when scrolling up', async () => {
    renderWithRouter(<SiteHeader />)
    const header = await screen.findByRole('banner')

    await act(async () => {
      scrollWindowTo(400)
    })
    expect(header.hasAttribute('data-hidden')).toBe(true)

    await act(async () => {
      scrollWindowTo(360)
    })
    expect(header.hasAttribute('data-hidden')).toBe(false)
  })

  it('is visible again once back at the top of the page', async () => {
    renderWithRouter(<SiteHeader />)
    const header = await screen.findByRole('banner')

    await act(async () => {
      scrollWindowTo(400)
    })
    await act(async () => {
      scrollWindowTo(0)
    })

    expect(header.hasAttribute('data-hidden')).toBe(false)
  })

  it('has a background only while the page is scrolled away from the top', async () => {
    renderWithRouter(<SiteHeader />)
    const header = await screen.findByRole('banner')
    expect(header.hasAttribute('data-scrolled')).toBe(false)

    await act(async () => {
      scrollWindowTo(10)
    })
    expect(header.hasAttribute('data-scrolled')).toBe(true)

    await act(async () => {
      scrollWindowTo(0)
    })
    expect(header.hasAttribute('data-scrolled')).toBe(false)
  })
})
