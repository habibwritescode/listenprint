import { describe, expect, it } from 'vitest'
import { spreadLeadingFirstWords } from './generate.ts'

describe('spreadLeadingFirstWords', () => {
  it('pulls a later name forward so the leading ranks have distinct first words', () => {
    const names = ['Ada One', 'Ada Two', 'Bo Three', 'Ada Four']

    spreadLeadingFirstWords(names, 2)

    expect(names).toEqual(['Ada One', 'Bo Three', 'Ada Two', 'Ada Four'])
  })

  it('treats accent and case variants of a first word as the same word', () => {
    const names = ['Émile One', 'emile Two', 'Bo Three']

    spreadLeadingFirstWords(names, 2)

    expect(names).toEqual(['Émile One', 'Bo Three', 'emile Two'])
  })

  it('leaves names in place when no later name has an unused first word', () => {
    const names = ['Ada One', 'Ada Two', 'Ada Three']

    spreadLeadingFirstWords(names, 2)

    expect(names).toEqual(['Ada One', 'Ada Two', 'Ada Three'])
  })
})
