import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  redirect,
  stripSearchParams,
} from '@tanstack/react-router'
import type { RouterHistory, SearchSchemaInput } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { AuthSession } from './auth/session.ts'
import type { ViewTransitionSetting } from './navigation/browser.ts'
import type { LibrarySession } from './spotify/library-session.ts'
import { ErrorFallback } from './components/ErrorFallback.tsx'
import { demoGenresQueryOptions, demoLibraryQueryOptions } from './demo/demo-library-query.ts'
import { DEFAULT_SORT_ORDER, isSortOrder } from './library/presentation.ts'
import type { SortOrder } from './library/presentation.ts'
import { DEFAULT_RANKING_MODE, artistTracks, isRankingMode } from './library/rankings.ts'
import { DEFAULT_TIMELINE_GRAIN, isTimelineGrain } from './library/timeline-grain.ts'
import type { TimelineGrain } from './library/timeline-grain.ts'
import type { RankingMode } from './library/types.ts'
import { CallbackPending } from './routes/CallbackPending.tsx'
import { DemoPagePending } from './routes/DemoPagePending.tsx'
import { NotFoundPage } from './routes/NotFoundPage.tsx'
import { RankingsPage } from './routes/RankingsPage.tsx'
import { RootLayout } from './routes/RootLayout.tsx'
import { UnknownDemoArtist } from './routes/UnknownDemoArtist.tsx'
import { parseSearch, stringifySearch } from './search-params.ts'

export interface RouterContext {
  queryClient: QueryClient
  auth: AuthSession
  library: LibrarySession
}

interface CallbackSearch {
  code?: string
  state?: string
  error?: string
}

// Lossless search parsing (search-params.ts) can still turn a short all-digit value into a number, and
// String() restores its exact text.
function searchText(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined
}

function validateCallbackSearch(search: Record<string, unknown>): CallbackSearch {
  return { code: searchText(search.code), state: searchText(search.state), error: searchText(search.error) }
}

interface RankingSearch {
  mode: RankingMode
  sort: SortOrder
  /** The artist filter, kept on artist pages too so going back returns to the same filtered list. */
  q: string
}

interface TimelineSearch extends RankingSearch {
  grain: TimelineGrain
}

// Artist pages carry the list's sort too, only so their back link can restore it.
type RankingSearchInput = { mode?: RankingMode; sort?: SortOrder; q?: string } & SearchSchemaInput

function validateRankingSearch(search: RankingSearchInput): RankingSearch {
  return {
    mode: isRankingMode(search.mode) ? search.mode : DEFAULT_RANKING_MODE,
    sort: isSortOrder(search.sort) ? search.sort : DEFAULT_SORT_ORDER,
    q: searchText(search.q) ?? '',
  }
}

// The timeline carries mode and sort only so the nav can hand them back to the ranking.
function validateTimelineSearch(search: RankingSearchInput & { grain?: TimelineGrain }): TimelineSearch {
  return {
    ...validateRankingSearch(search),
    grain: isTimelineGrain(search.grain) ? search.grain : DEFAULT_TIMELINE_GRAIN,
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

// Live and demo routes share the same `mode` and `sort` search params, stripped at their defaults.
const rankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateRankingSearch,
  search: { middlewares: [stripSearchParams({ mode: DEFAULT_RANKING_MODE, sort: DEFAULT_SORT_ORDER, q: '' })] },
  component: RankingsPage,
})

const artistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/artist/$artistId',
  validateSearch: validateRankingSearch,
  search: { middlewares: [stripSearchParams({ mode: DEFAULT_RANKING_MODE, sort: DEFAULT_SORT_ORDER, q: '' })] },
  // Lazy through the router rather than React.lazy inside the page: the router loads the chunk before it commits, so
  // the header is rendered when the list-to-artist view transition captures the new page. A React.lazy boundary would
  // still suspend for a tick on first open, and the travelling tile would have nowhere to land.
  component: lazyRouteComponent(() => import('./routes/ArtistPage.tsx'), 'ArtistPage'),
})

// Demo views are lazy route components so the virtualizer and their UI stay out of the main bundle.
// Their pending component lives in its own module: importing it from the page would undo the split.
const demoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/demo',
  validateSearch: validateRankingSearch,
  search: { middlewares: [stripSearchParams({ mode: DEFAULT_RANKING_MODE, sort: DEFAULT_SORT_ORDER, q: '' })] },
  loader: ({ context }) => context.queryClient.ensureQueryData(demoLibraryQueryOptions),
  component: lazyRouteComponent(() => import('./routes/DemoPage.tsx'), 'DemoPage'),
  pendingComponent: DemoPagePending,
})

const genresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/genres',
  validateSearch: validateRankingSearch,
  search: { middlewares: [stripSearchParams({ mode: DEFAULT_RANKING_MODE, sort: DEFAULT_SORT_ORDER, q: '' })] },
  component: lazyRouteComponent(() => import('./routes/GenresPage.tsx'), 'GenresPage'),
})

const timelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timeline',
  validateSearch: validateTimelineSearch,
  search: {
    middlewares: [
      stripSearchParams({ mode: DEFAULT_RANKING_MODE, sort: DEFAULT_SORT_ORDER, q: '', grain: DEFAULT_TIMELINE_GRAIN }),
    ],
  },
  component: lazyRouteComponent(() => import('./routes/TimelinePage.tsx'), 'TimelinePage'),
})

const demoGenresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/demo/genres',
  validateSearch: validateRankingSearch,
  search: { middlewares: [stripSearchParams({ mode: DEFAULT_RANKING_MODE, sort: DEFAULT_SORT_ORDER, q: '' })] },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(demoLibraryQueryOptions),
      context.queryClient.ensureQueryData(demoGenresQueryOptions),
    ])
  },
  component: lazyRouteComponent(() => import('./routes/DemoGenresPage.tsx'), 'DemoGenresPage'),
  pendingComponent: DemoPagePending,
})

const demoTimelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/demo/timeline',
  validateSearch: validateTimelineSearch,
  search: {
    middlewares: [
      stripSearchParams({ mode: DEFAULT_RANKING_MODE, sort: DEFAULT_SORT_ORDER, q: '', grain: DEFAULT_TIMELINE_GRAIN }),
    ],
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(demoLibraryQueryOptions),
  component: lazyRouteComponent(() => import('./routes/DemoTimelinePage.tsx'), 'DemoTimelinePage'),
  pendingComponent: DemoPagePending,
})

const demoArtistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/demo/artist/$artistId',
  validateSearch: validateRankingSearch,
  search: { middlewares: [stripSearchParams({ mode: DEFAULT_RANKING_MODE, sort: DEFAULT_SORT_ORDER, q: '' })] },
  loader: async ({ context, params }) => {
    // Genres too: a page that suspends after the router commits has nothing for the view transition to land on.
    const [library] = await Promise.all([
      context.queryClient.ensureQueryData(demoLibraryQueryOptions),
      context.queryClient.ensureQueryData(demoGenresQueryOptions),
    ])
    const artist = artistTracks(library.tracks, params.artistId, 'all')
      .at(0)
      ?.artists.find((credit) => credit.id === params.artistId)
    if (!artist) throw notFound()
    return { artist }
  },
  component: lazyRouteComponent(() => import('./routes/DemoArtistPage.tsx'), 'DemoArtistPage'),
  pendingComponent: DemoPagePending,
  notFoundComponent: UnknownDemoArtist,
})

// Spotify's redirect back after sign-in. Completion happens in the loader, then the URL is replaced so the
// spent code never stays in history.
const callbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/callback',
  validateSearch: validateCallbackSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await context.auth.completeSignIn(deps)
    throw redirect({ to: '/', replace: true })
  },
  pendingComponent: CallbackPending,
  pendingMs: 0,
})

const routeTree = rootRoute.addChildren([
  rankingsRoute,
  artistRoute,
  genresRoute,
  timelineRoute,
  demoRoute,
  demoGenresRoute,
  demoTimelineRoute,
  demoArtistRoute,
  callbackRoute,
])

interface AppRouterOptions {
  queryClient: QueryClient
  auth: AuthSession
  library: LibrarySession
  history?: RouterHistory
  /** List ↔ artist view transitions; off unless the browser supports them (`createBrowserViewTransition`). */
  viewTransition?: ViewTransitionSetting
}

export function createAppRouter({ queryClient, auth, library, history, viewTransition = false }: AppRouterOptions) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient, auth, library },
    parseSearch,
    stringifySearch,
    defaultErrorComponent: ErrorFallback,
    scrollRestoration: true,
    defaultViewTransition: viewTransition,
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
  interface HistoryState {
    /** Set by ranking rows, so an artist page knows the list is the history entry behind it. */
    fromRanking?: boolean
  }
}
