// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRootRouteWithContext, createRouter } from '@tanstack/react-router'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { AuthSession } from '../auth/session.ts'
import type { RouterContext } from '../router.ts'
import { createTestSession, signedInStorage } from '../test/auth-session.ts'
import { createTestLibrarySession } from '../test/library-session.ts'
import { useAuth } from './useAuth.ts'

afterEach(cleanup)

function AuthProbe() {
  const { state, auth } = useAuth()
  return (
    <>
      <p>{state.status === 'signedIn' ? `signed in as ${state.displayName}` : state.status}</p>
      <button type="button" onClick={() => auth.signOut()}>
        Sign out
      </button>
    </>
  )
}

function renderProbe(auth: AuthSession) {
  const queryClient = new QueryClient()
  const router = createRouter({
    routeTree: createRootRouteWithContext<RouterContext>()({ component: AuthProbe }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { auth, queryClient, library: createTestLibrarySession({ auth, queryClient }).session },
  })
  return render(<RouterProvider router={router} />)
}

describe('useAuth', () => {
  it("reads the router context's session and re-renders when its state changes", async () => {
    const { session } = createTestSession({ localStorage: signedInStorage() })
    renderProbe(session)

    expect(await screen.findByText('signed in as Stored Listener')).toBeDefined()

    act(() => session.signOut())

    expect(screen.getByText('signedOut')).toBeDefined()
  })

  it('returns the session itself, so components can act on it', async () => {
    const user = userEvent.setup()
    const { session } = createTestSession({ localStorage: signedInStorage() })
    renderProbe(session)

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(session.getState()).toEqual({ status: 'signedOut' })
    expect(screen.getByText('signedOut')).toBeDefined()
  })
})
