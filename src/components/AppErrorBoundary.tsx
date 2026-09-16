import { Component } from 'react'
import type { ReactNode } from 'react'
import { ErrorFallback } from './ErrorFallback.tsx'

interface AppErrorBoundaryProps {
  children: ReactNode
}

type AppErrorBoundaryState = { hasError: false } | { hasError: true; error: unknown }

// Catches errors outside the router (providers, router setup). Errors inside routes
// are caught first by the router's defaultErrorComponent, which renders the same fallback.
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />
    }
    return this.props.children
  }
}
