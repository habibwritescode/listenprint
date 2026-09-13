import { QueryClient } from '@tanstack/react-query'

// Single app-wide client. Defaults are tuned in the spotify-client module.
export const queryClient = new QueryClient()
