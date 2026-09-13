import { Link, Outlet } from '@tanstack/react-router'

const navLinkClass = 'text-muted transition-colors hover:text-text data-[status=active]:text-accent'

export function RootLayout() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-6 sm:px-8">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-10 focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:font-semibold focus:text-on-accent"
      >
        Skip to content
      </a>

      <header className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <Link to="/" className="text-lg font-bold tracking-tight text-text">
          Listenprint
        </Link>
        <nav aria-label="Primary">
          <ul className="flex gap-6 text-sm font-medium">
            <li>
              <Link to="/" activeOptions={{ exact: true }} className={navLinkClass}>
                Rankings
              </Link>
            </li>
            <li>
              <Link to="/demo" className={navLinkClass}>
                Demo
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main id="content" tabIndex={-1} className="flex-1 py-8 outline-none">
        <Outlet />
      </main>
    </div>
  )
}
