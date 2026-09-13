import { createRootRouteWithContext, createRoute, createRouter } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { queryClient } from './query-client.ts'
import { RootLayout } from './routes/RootLayout.tsx'
import { RankingsPage } from './routes/RankingsPage.tsx'

export interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

const rankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: RankingsPage,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([rankingsRoute]),
  context: { queryClient },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
