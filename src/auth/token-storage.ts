import { isFiniteNumber, isNonEmptyString, isRecord } from './guards.ts'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const TOKENS_KEY = 'listenprint:auth'
export const PENDING_SIGN_IN_KEY = 'listenprint:pending-sign-in'

const TOKENS_VERSION = 1

export interface StoredTokens {
  accessToken: string
  refreshToken: string
  /** Epoch milliseconds. */
  expiresAt: number
  scope: string
  displayName: string
}

/** The PKCE values for a sign-in that left for Spotify and hasn't come back yet. */
export interface PendingSignIn {
  verifier: string
  state: string
  /** Epoch milliseconds. */
  createdAt: number
}

function remove(storage: StorageLike, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    // Storage that can't be accessed holds nothing of ours to remove.
  }
}

// Reads never throw: blocked storage (some private modes) and unreadable values count as nothing
// stored, and an unreadable value is removed so it can't break every later load.
function readJson<T>(storage: StorageLike, key: string, parse: (value: unknown) => T | null): T | null {
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return null
  }
  if (raw === null) return null

  let value: T | null
  try {
    value = parse(JSON.parse(raw))
  } catch {
    value = null
  }
  if (value === null) remove(storage, key)
  return value
}

function parseTokens(value: unknown): StoredTokens | null {
  if (!isRecord(value) || value.version !== TOKENS_VERSION) return null
  const { accessToken, refreshToken, expiresAt, scope, displayName } = value
  if (
    !isNonEmptyString(accessToken) ||
    !isNonEmptyString(refreshToken) ||
    !isFiniteNumber(expiresAt) ||
    typeof scope !== 'string' ||
    !isNonEmptyString(displayName)
  ) {
    return null
  }
  return { accessToken, refreshToken, expiresAt, scope, displayName }
}

function parsePendingSignIn(value: unknown): PendingSignIn | null {
  if (!isRecord(value)) return null
  const { verifier, state, createdAt } = value
  if (!isNonEmptyString(verifier) || !isNonEmptyString(state) || !isFiniteNumber(createdAt)) return null
  return { verifier, state, createdAt }
}

export function readTokens(storage: StorageLike): StoredTokens | null {
  return readJson(storage, TOKENS_KEY, parseTokens)
}

/** Throws if storage rejects the write; the caller decides whether a session can continue in memory. */
export function writeTokens(storage: StorageLike, tokens: StoredTokens): void {
  storage.setItem(TOKENS_KEY, JSON.stringify({ version: TOKENS_VERSION, ...tokens }))
}

export function clearTokens(storage: StorageLike): void {
  remove(storage, TOKENS_KEY)
}

export function readPendingSignIn(storage: StorageLike): PendingSignIn | null {
  return readJson(storage, PENDING_SIGN_IN_KEY, parsePendingSignIn)
}

/** Throws if storage rejects the write: without it, the callback can't be verified. */
export function writePendingSignIn(storage: StorageLike, pending: PendingSignIn): void {
  storage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify(pending))
}

export function clearPendingSignIn(storage: StorageLike): void {
  remove(storage, PENDING_SIGN_IN_KEY)
}
