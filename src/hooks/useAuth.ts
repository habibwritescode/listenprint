import { getRouteApi } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'

const rootRoute = getRouteApi('__root__')

/** The app's auth session from router context, and its current state. */
export function useAuth() {
  const { auth } = rootRoute.useRouteContext()
  const state = useSyncExternalStore(auth.subscribe, auth.getState)
  return { state, auth }
}
