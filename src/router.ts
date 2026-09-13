import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  stripSearchParams,
} from '@tanstack/react-router'
import type { RouterHistory, SearchSchemaInput } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ErrorFallback } from './components/ErrorFallback.tsx'
import { demoLibraryQueryOptions } from './demo/demo-library-query.ts'
import { DEFAULT_RANKING_MODE, artistTracks, isRankingMode } from './library/rankings.ts'
import type { RankingMode } from './library/types.ts'
import { ArtistPage } from './routes/ArtistPage.tsx'
import { DemoPagePending } from './routes/DemoPagePending.tsx'
import { NotFoundPage } from './routes/NotFoundPage.tsx'
import { RankingsPage } from './routes/RankingsPage.tsx'
import { RootLayout } from './routes/RootLayout.tsx'

export interface RouterContext {
  queryClient: QueryClient
}

interface RankingSearch {
  mode: RankingMode
}

function validateRankingSearch(search: { mode?: RankingMode } & SearchSchemaInput): RankingSearch {
  return { mode: isRankingMode(search.mode) ? search.mode : DEFAULT_RANKING_MODE }
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

// Demo views are lazy route components so the virtualizer and their UI stay out of the main bundle.
// Their pending component lives in its own module: importing it from the page would undo the split.
const demoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/demo',
  validateSearch: validateRankingSearch,
  search: { middlewares: [stripSearchParams({ mode: DEFAULT_RANKING_MODE })] },
  loader: ({ context }) => context.queryClient.ensureQueryData(demoLibraryQueryOptions),
  component: lazyRouteComponent(() => import('./routes/DemoPage.tsx'), 'DemoPage'),
  pendingComponent: DemoPagePending,
})

const demoArtistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/demo/artist/$artistId',
  validateSearch: validateRankingSearch,
  search: { middlewares: [stripSearchParams({ mode: DEFAULT_RANKING_MODE })] },
  loader: async ({ context, params }) => {
    const library = await context.queryClient.ensureQueryData(demoLibraryQueryOptions)
    const artist = artistTracks(library.tracks, params.artistId, 'all')
      .at(0)
      ?.artists.find((credit) => credit.id === params.artistId)
    if (!artist) throw notFound()
    return { artist }
  },
  component: lazyRouteComponent(() => import('./routes/DemoArtistPage.tsx'), 'DemoArtistPage'),
  pendingComponent: DemoPagePending,
})

const routeTree = rootRoute.addChildren([rankingsRoute, artistRoute, demoRoute, demoArtistRoute])

interface AppRouterOptions {
  queryClient: QueryClient
  history?: RouterHistory
}

export function createAppRouter({ queryClient, history }: AppRouterOptions) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultErrorComponent: ErrorFallback,
    scrollRestoration: true,
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
