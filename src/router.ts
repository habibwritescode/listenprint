import { createRootRouteWithContext, createRoute, createRouter } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ErrorFallback } from './components/ErrorFallback.tsx'
import { demoLibraryQueryOptions } from './demo/demo-library-query.ts'
import { queryClient } from './query-client.ts'
import { ArtistPage } from './routes/ArtistPage.tsx'
import { DemoPage, DemoPagePending } from './routes/DemoPage.tsx'
import { NotFoundPage } from './routes/NotFoundPage.tsx'
import { RankingsPage } from './routes/RankingsPage.tsx'
import { RootLayout } from './routes/RootLayout.tsx'

export interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

const rankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: RankingsPage,
})

const artistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/artist/$artistId',
  component: ArtistPage,
})

const demoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/demo',
  loader: ({ context }) => context.queryClient.ensureQueryData(demoLibraryQueryOptions),
  component: DemoPage,
  pendingComponent: DemoPagePending,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([rankingsRoute, artistRoute, demoRoute]),
  context: { queryClient },
  defaultErrorComponent: ErrorFallback,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
