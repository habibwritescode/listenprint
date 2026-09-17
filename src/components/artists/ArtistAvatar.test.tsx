// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ArtistAvatar } from './ArtistAvatar.tsx'

afterEach(cleanup)

function parts(container: HTMLElement) {
  const tile = container.firstElementChild as HTMLElement
  return {
    tile,
    image: tile.querySelector('img'),
    shimmer: tile.querySelector('[data-slot="shimmer"]'),
  }
}

describe('ArtistAvatar', () => {
  it('is a letter tile, hidden from assistive technology, when there is no photo', () => {
    const { container } = render(<ArtistAvatar name="Velvet Harbor" />)
    const { tile, image } = parts(container)

    expect(tile.getAttribute('aria-hidden')).toBe('true')
    expect(tile.textContent).toBe('V')
    expect(image).toBeNull()
  })

  // The letter is the base layer, so a slow or failed photo never leaves a hole or a broken-image icon.
  it('keeps the letter under a shimmer while the photo loads, then shows the photo', () => {
    const { container } = render(<ArtistAvatar name="Velvet Harbor" imageUrl="https://i.scdn.co/image/v" />)
    const { tile, image, shimmer } = parts(container)

    expect(tile.textContent).toBe('V')
    expect(image?.getAttribute('src')).toBe('https://i.scdn.co/image/v')
    expect(image?.getAttribute('alt')).toBe('')
    expect(image?.dataset.state).toBe('loading')
    expect(shimmer).not.toBeNull()

    fireEvent.load(image as HTMLImageElement)

    expect(parts(container).image?.dataset.state).toBe('loaded')
    expect(parts(container).shimmer).toBeNull()
  })

  it('falls back to the letter, with no retry, when the photo fails', () => {
    const { container } = render(<ArtistAvatar name="Velvet Harbor" imageUrl="https://i.scdn.co/image/v" />)

    fireEvent.error(parts(container).image as HTMLImageElement)

    expect(parts(container).image).toBeNull()
    expect(parts(container).shimmer).toBeNull()
    expect(parts(container).tile.textContent).toBe('V')
  })

  it('starts over when the photo changes', () => {
    const { container, rerender } = render(<ArtistAvatar name="Velvet Harbor" imageUrl="https://i.scdn.co/image/a" />)
    fireEvent.error(parts(container).image as HTMLImageElement)

    rerender(<ArtistAvatar name="Velvet Harbor" imageUrl="https://i.scdn.co/image/b" />)

    expect(parts(container).image?.getAttribute('src')).toBe('https://i.scdn.co/image/b')
  })

  // The list ↔ artist view transition moves the tile with this name; the stylesheet applies it only during one.
  it('carries a view transition name only when given one', () => {
    const named = render(<ArtistAvatar name="Velvet Harbor" transitionName="artist-abc" />)
    const tile = parts(named.container).tile
    expect(tile.style.getPropertyValue('--artist-tile')).toBe('artist-abc')
    expect(tile.hasAttribute('data-artist-tile')).toBe(true)
    cleanup()

    const plain = parts(render(<ArtistAvatar name="Velvet Harbor" size="art" />).container).tile
    expect(plain.style.getPropertyValue('--artist-tile')).toBe('')
    expect(plain.hasAttribute('data-artist-tile')).toBe(false)
  })
})
