import { Link, useLocation } from '@tanstack/react-router'
import { Notice } from '../components/Notice.tsx'
import { ghostActionClass, primaryActionClass } from '../components/action-styles.ts'

export function NotFoundPage() {
  const { pathname } = useLocation()

  return (
    <Notice
      tone="neutral"
      kicker="404"
      title="There’s no page at this address."
      body="The address doesn’t match any page in Listenprint. If you followed a link with a ranking mode in it, the link may have been cut off."
      detail={pathname}
    >
      <Link to="/" className={primaryActionClass}>
        Go to the home page
      </Link>
      <Link to="/demo" className={ghostActionClass}>
        Open the demo
      </Link>
    </Notice>
  )
}
