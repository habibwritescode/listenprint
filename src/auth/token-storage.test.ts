import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../test/memory-storage.ts'
import {
  PENDING_SIGN_IN_KEY,
  TOKENS_KEY,
  clearPendingSignIn,
  clearTokens,
  readPendingSignIn,
  readTokens,
  writePendingSignIn,
  writeTokens,
} from './token-storage.ts'
import type { PendingSignIn, StorageLike, StoredTokens } from './token-storage.ts'

const tokens: StoredTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: 1_800_000_000_000,
  scope: 'user-library-read',
  displayName: 'Test Listener',
}

const pending: PendingSignIn = { verifier: 'verifier', state: 'state', createdAt: 1_700_000_000_000 }

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('blocked', 'SecurityError')
  },
  removeItem: () => {
    throw new DOMException('blocked', 'SecurityError')
  },
}

describe('stored tokens', () => {
  it('round-trips, stored with a format version', () => {
    const storage = createMemoryStorage()

    writeTokens(storage, tokens)

    expect(readTokens(storage)).toEqual(tokens)
    expect(JSON.parse(storage.entries()[TOKENS_KEY])).toEqual({ version: 1, ...tokens })
  })

  it('reads as none when nothing is stored', () => {
    expect(readTokens(createMemoryStorage())).toBeNull()
  })

  it('clears', () => {
    const storage = createMemoryStorage()
    writeTokens(storage, tokens)

    clearTokens(storage)

    expect(storage.entries()).toEqual({})
  })

  // A value from an older format or a hand-edited key must not strand someone in a broken session.
  it.each([
    ['corrupt JSON', '{"version":1,'],
    ['a non-object', '[]'],
    ['null', 'null'],
    ['another format version', JSON.stringify({ ...tokens, version: 2 })],
    ['no version', JSON.stringify(tokens)],
    ...(['accessToken', 'refreshToken', 'expiresAt', 'scope', 'displayName'] as const).map((field) => {
      const stored: Record<string, unknown> = { version: 1, ...tokens }
      delete stored[field]
      return [`no ${field}`, JSON.stringify(stored)] as [string, string]
    }),
    ['an empty access token', JSON.stringify({ version: 1, ...tokens, accessToken: '' })],
    ['expiresAt as a string', JSON.stringify({ version: 1, ...tokens, expiresAt: '1800000000000' })],
    ['expiresAt as null', JSON.stringify({ version: 1, ...tokens, expiresAt: null })],
    ['displayName as a number', JSON.stringify({ version: 1, ...tokens, displayName: 42 })],
  ])('reads %s as none and removes it', (_case, raw) => {
    const storage = createMemoryStorage({ [TOKENS_KEY]: raw, other: 'kept' })

    expect(readTokens(storage)).toBeNull()
    expect(storage.entries()).toEqual({ other: 'kept' })
  })

  it('reads as none, without throwing, when storage is blocked', () => {
    expect(readTokens(throwingStorage)).toBeNull()
    expect(() => clearTokens(throwingStorage)).not.toThrow()
  })
})

describe('pending sign-in', () => {
  it('round-trips and clears', () => {
    const storage = createMemoryStorage()

    writePendingSignIn(storage, pending)
    expect(readPendingSignIn(storage)).toEqual(pending)

    clearPendingSignIn(storage)
    expect(storage.entries()).toEqual({})
  })

  it('reads as none when nothing is stored', () => {
    expect(readPendingSignIn(createMemoryStorage())).toBeNull()
  })

  it.each([
    ['corrupt JSON', '{'],
    ['a non-object', '[]'],
    ['no verifier', JSON.stringify({ state: 'state', createdAt: 1 })],
    ['no state', JSON.stringify({ verifier: 'verifier', createdAt: 1 })],
    ['no createdAt', JSON.stringify({ verifier: 'verifier', state: 'state' })],
    ['an empty state', JSON.stringify({ ...pending, state: '' })],
  ])('reads %s as none and removes it', (_case, raw) => {
    const storage = createMemoryStorage({ [PENDING_SIGN_IN_KEY]: raw })

    expect(readPendingSignIn(storage)).toBeNull()
    expect(storage.entries()).toEqual({})
  })

  it('reads as none, without throwing, when storage is blocked', () => {
    expect(readPendingSignIn(throwingStorage)).toBeNull()
    expect(() => clearPendingSignIn(throwingStorage)).not.toThrow()
  })
})
