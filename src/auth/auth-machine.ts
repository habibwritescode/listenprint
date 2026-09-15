import type { StoredTokens } from './token-storage.ts'

export type SignedOutNotice = 'cancelled' | 'unverified' | 'expired'

export type AuthState =
  | { status: 'signedOut'; notice?: SignedOutNotice }
  | { status: 'redirecting' }
  | { status: 'completing' }
  | { status: 'signedIn'; displayName: string }
  | { status: 'notAllowlisted' }
  /** A network failure while completing sign-in. The code can't be reused, so recovery starts over. */
  | { status: 'error' }

export type AuthEvent =
  | { type: 'START' }
  | { type: 'BEGIN_COMPLETION' }
  | { type: 'VERIFIED'; displayName: string }
  | { type: 'FORBIDDEN' }
  | { type: 'REJECTED'; notice: 'cancelled' | 'unverified' }
  | { type: 'NETWORK_FAILED' }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'SIGN_OUT' }

// No default case: every event returns inside the switch, so adding an event type without handling it
// fails `tsc -b` ("Function lacks ending return statement"), with no unreachable runtime branch.
// Ignored events return the same state object, so subscribers comparing states don't re-render.
export function authReducer(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case 'START':
      return state.status === 'signedOut' || state.status === 'error' ? { status: 'redirecting' } : state
    case 'BEGIN_COMPLETION':
      return state.status === 'signedOut' ? { status: 'completing' } : state
    case 'VERIFIED':
      return state.status === 'completing' ? { status: 'signedIn', displayName: event.displayName } : state
    case 'FORBIDDEN':
      return state.status === 'completing' ? { status: 'notAllowlisted' } : state
    case 'REJECTED':
      return state.status === 'completing' ? { status: 'signedOut', notice: event.notice } : state
    case 'NETWORK_FAILED':
      return state.status === 'completing' ? { status: 'error' } : state
    case 'SESSION_EXPIRED':
      return state.status === 'signedIn' ? { status: 'signedOut', notice: 'expired' } : state
    case 'SIGN_OUT': {
      const inFlight = state.status === 'redirecting' || state.status === 'completing'
      const alreadySignedOut = state.status === 'signedOut' && state.notice === undefined
      return inFlight || alreadySignedOut ? state : { status: 'signedOut' }
    }
  }
}

export function initialAuthState(tokens: StoredTokens | null): AuthState {
  return tokens ? { status: 'signedIn', displayName: tokens.displayName } : { status: 'signedOut' }
}
