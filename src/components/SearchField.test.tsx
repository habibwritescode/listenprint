// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchField } from './SearchField.tsx'

afterEach(cleanup)

function renderField(overrides: Partial<Parameters<typeof SearchField>[0]> = {}) {
  const onQueryChange = vi.fn<(query: string) => void>()
  const onCommit = vi.fn<(query: string) => void>()
  render(<SearchField query="" onQueryChange={onQueryChange} onCommit={onCommit} matchCount={null} {...overrides} />)
  return { onQueryChange, onCommit, field: screen.getByRole('searchbox', { name: 'Search artists' }) }
}

describe('SearchField', () => {
  // The list filters on every keystroke; the URL gets one entry for the word, not one per letter.
  it('reports every keystroke, and the URL only once typing stops', async () => {
    const user = userEvent.setup()
    const { onQueryChange, onCommit, field } = renderField()

    await user.type(field, 'velvet')

    expect(onQueryChange).toHaveBeenCalledTimes(6)
    expect(onQueryChange).toHaveBeenLastCalledWith('velvet')

    await waitFor(() => expect(onCommit).toHaveBeenCalled())
    expect(onCommit.mock.calls).toEqual([['velvet']])
  })

  it('shows a query that arrived in the URL', () => {
    renderField({ query: 'velvet' })

    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('velvet')
  })

  it('clears on Escape and keeps focus in the field', async () => {
    const user = userEvent.setup()
    const { onQueryChange, field } = renderField({ query: 'velvet' })
    await user.click(field)

    await user.keyboard('{Escape}')

    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('')
    expect(onQueryChange).toHaveBeenLastCalledWith('')
    expect(document.activeElement).toBe(field)
  })

  // The header hides on scroll down, so the shortcut has to bring it back as well as focus the field.
  it('takes focus on / and on ⌘K from anywhere on the page', async () => {
    const user = userEvent.setup()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { field } = renderField()
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()

    await user.keyboard('/')
    expect(document.activeElement).toBe(field)
    expect(scrollTo).toHaveBeenCalled()

    outside.focus()
    await user.keyboard('{Meta>}k{/Meta}')
    expect(document.activeElement).toBe(field)

    outside.remove()
    vi.restoreAllMocks()
  })

  it('lets a slash be typed into the field itself', async () => {
    const user = userEvent.setup()
    const { onQueryChange, field } = renderField()

    await user.click(field)
    await user.keyboard('a/b')

    expect(onQueryChange).toHaveBeenLastCalledWith('a/b')
  })

  it('hands the keyboard to the list on ArrowDown', async () => {
    const user = userEvent.setup()
    const onEnterList = vi.fn()
    renderField({ onEnterList })
    await user.click(screen.getByRole('searchbox'))

    await user.keyboard('{ArrowDown}')

    expect(onEnterList).toHaveBeenCalled()
  })

  it('announces how many artists match', () => {
    renderField({ query: 'velvet', matchCount: 3 })

    expect(screen.getByRole('status').textContent).toBe('3 artists match velvet')
  })

  it('says nothing while there is nothing to report', () => {
    renderField()

    expect(screen.getByRole('status').textContent).toBe('')
  })
})
