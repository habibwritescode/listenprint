import { describe, expect, it } from 'vitest'
import { authReducer, initialAuthState } from './auth-machine.ts'
import type { AuthEvent, AuthState } from './auth-machine.ts'

const signedOut: AuthState = { status: 'signedOut' }
const signedOutExpired: AuthState = { status: 'signedOut', notice: 'expired' }
const redirecting: AuthState = { status: 'redirecting' }
const completing: AuthState = { status: 'completing' }
const signedIn: AuthState = { status: 'signedIn', displayName: 'Test Listener' }
const notAllowlisted: AuthState = { status: 'notAllowlisted' }
const failed: AuthState = { status: 'error' }

const START: AuthEvent = { type: 'START' }
const BEGIN_COMPLETION: AuthEvent = { type: 'BEGIN_COMPLETION' }
const VERIFIED: AuthEvent = { type: 'VERIFIED', displayName: 'Test Listener' }
const FORBIDDEN: AuthEvent = { type: 'FORBIDDEN' }
const CANCELLED: AuthEvent = { type: 'REJECTED', notice: 'cancelled' }
const UNVERIFIED: AuthEvent = { type: 'REJECTED', notice: 'unverified' }
const NETWORK_FAILED: AuthEvent = { type: 'NETWORK_FAILED' }
const SESSION_EXPIRED: AuthEvent = { type: 'SESSION_EXPIRED' }
const SIGN_OUT: AuthEvent = { type: 'SIGN_OUT' }

const STATES = [signedOut, signedOutExpired, redirecting, completing, signedIn, notAllowlisted, failed]
const EVENTS = [START, BEGIN_COMPLETION, VERIFIED, FORBIDDEN, CANCELLED, UNVERIFIED, NETWORK_FAILED, SESSION_EXPIRED, SIGN_OUT]

// The spec's state table, row by row. Anything not listed here must leave the state untouched.
const TRANSITIONS: Array<[AuthState, AuthEvent, AuthState]> = [
  [signedOut, START, redirecting],
  [signedOutExpired, START, redirecting],
  [failed, START, redirecting],
  [signedOut, BEGIN_COMPLETION, completing],
  [signedOutExpired, BEGIN_COMPLETION, completing],
  [completing, VERIFIED, { status: 'signedIn', displayName: 'Test Listener' }],
  [completing, FORBIDDEN, notAllowlisted],
  [completing, CANCELLED, { status: 'signedOut', notice: 'cancelled' }],
  [completing, UNVERIFIED, { status: 'signedOut', notice: 'unverified' }],
  [completing, NETWORK_FAILED, failed],
  [signedIn, SESSION_EXPIRED, signedOutExpired],
  [signedIn, SIGN_OUT, signedOut],
  [notAllowlisted, SIGN_OUT, signedOut],
  [failed, SIGN_OUT, signedOut],
  [signedOutExpired, SIGN_OUT, signedOut],
]

function label(value: AuthState | AuthEvent) {
  return JSON.stringify(value)
}

describe('authReducer', () => {
  it.each(TRANSITIONS.map(([from, event, to]) => [label(from), label(event), label(to), from, event, to] as const))(
    '%s + %s → %s',
    (_from, _event, _to, from, event, to) => {
      expect(authReducer(from, event)).toEqual(to)
    },
  )

  const listed = new Set(TRANSITIONS.map(([from, event]) => `${label(from)} ${label(event)}`))
  const ignored = STATES.flatMap((state) =>
    EVENTS.filter((event) => !listed.has(`${label(state)} ${label(event)}`)).map(
      (event) => [label(state), label(event), state, event] as const,
    ),
  )

  // The same object back, so subscribers comparing states don't re-render for an ignored event.
  it.each(ignored)('%s ignores %s', (_state, _event, state, event) => {
    expect(authReducer(state, event)).toBe(state)
  })
})

describe('initialAuthState', () => {
  it('starts signed out without stored tokens', () => {
    expect(initialAuthState(null)).toEqual(signedOut)
  })

  it('starts signed in with the stored display name when tokens are stored', () => {
    const stored = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 0,
      scope: 'user-library-read',
      displayName: 'Stored Listener',
    }

    expect(initialAuthState(stored)).toEqual({ status: 'signedIn', displayName: 'Stored Listener' })
  })
})
